'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Route, RouteStop } from '@/types'

const HAGLA: [number, number] = [32.38639, 34.92667]

declare global {
  interface Window { L: any }
}

export function MapView({
  routes,
  activeId,
  onSelect,
}: {
  routes: Route[]
  activeId: number | null
  onSelect: (id: number) => void
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layers = useRef<Record<number, any[]>>({})
  const [mapReady, setMapReady] = useState(false)

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    let cancelled = false

    const boot = async () => {
      if (!window.L) {
        await new Promise<void>(res => {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          script.onload = () => res()
          document.head.appendChild(script)
        })
      }
      if (cancelled || !divRef.current) return

      const L = window.L
      const map = L.map(divRef.current, { center: HAGLA, zoom: 9, zoomControl: false })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © Carto', maxZoom: 19,
      }).addTo(map)
      L.control.zoom({ position: 'bottomleft' }).addTo(map)

      // Hagla home pin
      L.marker(HAGLA, {
        icon: L.divIcon({
          html: `<div style="width:32px;height:32px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;border:3px solid #f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.2)">🏠</div>`,
          iconSize: [32, 32], iconAnchor: [16, 16], className: '',
        }),
      }).addTo(map).bindPopup(
        `<div style="font-family:Heebo,sans-serif;font-weight:700;font-size:13px;padding:4px">מושב חגלה — בסיס</div>`
      )

      mapRef.current = map
      map.invalidateSize()
      if (!cancelled) setMapReady(true)
    }

    boot()
    return () => { cancelled = true }
  }, [])

  // ── Redraw when routes change OR map becomes ready ────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    mapRef.current.invalidateSize()
    setTimeout(() => draw(routes), 50)
  }, [routes, mapReady])

  // ── Dim/highlight when activeId changes ───────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    Object.entries(layers.current).forEach(([id, ls]) => {
      const on = !activeId || parseInt(id) === activeId
      ls.forEach((l: any) => {
        l.setOpacity?.(on ? 0.9 : 0.12)
        l.setStyle?.({ opacity: on ? 0.85 : 0.12, weight: on ? 3.5 : 2 })
      })
    })
  }, [activeId, mapReady])

  // ── Draw all routes ───────────────────────────────────────────────────────
  const draw = (routes: Route[]) => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map) return

    // Clear old layers
    Object.values(layers.current).flat().forEach((l: any) => map.removeLayer(l))
    layers.current = {}

    const bounds: [number, number][] = [HAGLA]

    routes.forEach(route => {
      const ls: any[] = []
      const valid = route.stops.filter(s => s.lat && s.lng)
      if (!valid.length) return

      // Polyline: Hagla → stops in order → Hagla
      const pts: [number, number][] = [
        HAGLA,
        ...valid.map(s => [s.lat!, s.lng!] as [number, number]),
        HAGLA,
      ]
      const line = L.polyline(pts, {
        color: route.color, weight: 3, opacity: 0.85,
        dashArray: route.direction === 'דרום' ? '9,5' : undefined,
      }).addTo(map)
      line.on('click', () => onSelect(route.id))
      ls.push(line)

      // ── Group co-located stops (same lat/lng) into one marker ─────────────
      // Key = "lat,lng" rounded to 4 decimal places (~11 m precision)
      const locationMap = new Map<string, RouteStop[]>()
      for (const stop of valid) {
        const key = `${stop.lat!.toFixed(4)},${stop.lng!.toFixed(4)}`
        if (!locationMap.has(key)) locationMap.set(key, [])
        locationMap.get(key)!.push(stop)
      }

      locationMap.forEach((stopsAtLoc, _key) => {
        const first = stopsAtLoc[0]
        const multi = stopsAtLoc.length > 1
        const totalCartsSite = stopsAtLoc.reduce((a, s) => a + Number(s.carts), 0)
        const hasWarn = stopsAtLoc.some(
          s => s.notes && (s.notes.includes('חובה') || s.notes.includes('מזומן'))
        )

        // Always show the cart number if available, otherwise blank
        // For multi-stop locations, add a small corner count badge
        const orderLabel = `${first.cart_number || ''}`
        const size = 26

        const cornerBadge = multi
          ? `<div style="
              position:absolute;top:-4px;left:-4px;
              width:14px;height:14px;border-radius:50%;
              background:#fbbf24;color:#000;
              font-size:8px;font-weight:900;
              display:flex;align-items:center;justify-content:center;
              border:1.5px solid #000;font-family:Heebo,sans-serif;
              line-height:1;
            ">${stopsAtLoc.length}</div>`
          : ''

        const markerHtml = `
          <div style="position:relative;width:${size}px;height:${size}px;">
            <div style="
              width:${size}px;height:${size}px;
              background:${route.color};color:#fff;border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              font-weight:800;font-size:10px;
              border:2px solid rgba(255,255,255,.85);
              box-shadow:0 2px 10px rgba(0,0,0,.5);
              font-family:Heebo,sans-serif;
            ">${orderLabel}</div>
            ${cornerBadge}
          </div>`

        // Build popup HTML — show each co-located customer separately
        const customersHtml = stopsAtLoc.map(s => {
          const warn = s.notes && (s.notes.includes('חובה') || s.notes.includes('מזומן'))
          return `
            <div style="border-top:1px solid #1e2d45;padding-top:8px;margin-top:8px;first-child:border:none">
              <div style="font-size:14px;font-weight:800">${s.name}</div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin:4px 0">
                ${s.carts ? `<span style="background:${route.color}22;color:${route.color};padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700">🛒 ${s.carts}</span>` : ''}
                ${s.time_window ? `<span style="background:#3b82f620;color:#93c5fd;padding:2px 9px;border-radius:12px;font-size:11px">⏰ ${s.time_window}</span>` : ''}
              </div>
              ${s.notes ? `<div style="background:${warn ? 'rgba(239,68,68,.1)' : 'rgba(255,255,255,.04)'};border-radius:8px;padding:5px 8px;font-size:11px;color:${warn ? '#fca5a5' : '#94a3b8'}">${s.notes}</div>` : ''}
              <div style="margin-top:4px;font-size:10px;color:#475569">${route.name} · עצירה ${s.order}</div>
            </div>`
        }).join('')

        const popupHtml = `
          <div style="font-family:Heebo,sans-serif;direction:rtl;padding:4px 2px;min-width:200px">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px">${first.address}</div>
            ${multi ? `<div style="font-size:11px;font-weight:700;color:#fbbf24;margin-bottom:4px">🏢 ${stopsAtLoc.length} לקוחות · 🛒 ${totalCartsSite} עגלות</div>` : ''}
            ${customersHtml}
          </div>`

        const marker = L.marker([first.lat, first.lng], {
          icon: L.divIcon({
            html: markerHtml,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            className: '',
          }),
        }).addTo(map).bindPopup(popupHtml)

        ls.push(marker)
        bounds.push([first.lat!, first.lng!])
      })

      layers.current[route.id] = ls
    })

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] })
  }

  // ── Map search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<{ name: string; lat: number; lng: number } | null>(null)
  const searchMarkerRef = useRef<any>(null)

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q || !mapReady || !mapRef.current) return
    setSearching(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', ישראל')}&format=json&limit=1&countrycodes=il`
      const res = await fetch(url, { headers: { 'User-Agent': 'HaglaRouteApp/2.0' } })
      const data = await res.json()
      if (!data?.length) { alert('לא נמצאה כתובת — נסה שוב'); return }
      const { lat, lon, display_name } = data[0]
      const clat = parseFloat(lat), clng = parseFloat(lon)
      const L = window.L
      const map = mapRef.current

      // Remove old search marker
      if (searchMarkerRef.current) map.removeLayer(searchMarkerRef.current)

      const shortName = display_name.split(',').slice(0, 2).join(', ')

      const icon = L.divIcon({
        html: `<div style="
          position:relative;width:32px;height:32px;
          display:flex;align-items:center;justify-content:center;
        ">
          <div style="
            width:32px;height:32px;border-radius:50%;
            background:linear-gradient(135deg,#f59e0b,#ef4444);
            display:flex;align-items:center;justify-content:center;
            font-size:16px;
            border:3px solid rgba(255,255,255,.9);
            box-shadow:0 0 0 4px rgba(245,158,11,.3),0 4px 16px rgba(0,0,0,.5);
            animation:pulse 1.5s ease-in-out infinite;
          ">🔍</div>
        </div>`,
        iconSize: [32, 32], iconAnchor: [16, 16], className: '',
      })

      const marker = L.marker([clat, clng], { icon }).addTo(map)
      marker.bindPopup(
        `<div style="font-family:Heebo,sans-serif;direction:rtl;padding:4px 2px;min-width:180px">
          <div style="font-size:13px;font-weight:800;color:#f59e0b;margin-bottom:4px">🔍 תוצאת חיפוש</div>
          <div style="font-size:12px;color:#e2e8f0">${shortName}</div>
          <div style="font-size:10px;color:#475569;margin-top:4px">${clat.toFixed(5)}, ${clng.toFixed(5)}</div>
        </div>`
      ).openPopup()

      searchMarkerRef.current = marker
      map.setView([clat, clng], 14, { animate: true })
      setSearchResult({ name: shortName, lat: clat, lng: clng })
    } catch { alert('שגיאה בחיפוש') }
    finally { setSearching(false) }
  }, [searchQuery, mapReady])

  const clearSearch = () => {
    if (searchMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(searchMarkerRef.current)
      searchMarkerRef.current = null
    }
    setSearchResult(null)
    setSearchQuery('')
  }

  return (
    <div className="relative w-full h-full">
      {/* Leaflet map */}
      <div ref={divRef} className="w-full h-full" />

      {/* ── Floating search bar ── */}
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex gap-1.5 items-center"
        style={{ width: 'min(400px, 85%)' }}
      >
        <div
          className="flex flex-1 items-center rounded-xl overflow-hidden shadow-xl"
          style={{ background: '#0f1d30cc', backdropFilter: 'blur(8px)', border: '1px solid #1e2d45' }}
        >
          <span className="px-2.5 text-slate-500 text-sm shrink-0">🔍</span>
          <input
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none py-2 pr-1"
            placeholder="חפש מקום, כתובת, ישוב..."
            value={searchQuery}
            dir="rtl"
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          {searchResult && (
            <button
              onClick={clearSearch}
              className="px-2 text-slate-500 hover:text-slate-300 transition-colors text-base shrink-0"
            >✕</button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          className="shrink-0 py-2 px-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg,#f59e0b,#d97706)',
            color: '#000',
            boxShadow: '0 2px 12px rgba(245,158,11,.4)',
          }}
        >
          {searching ? '⏳' : 'חפש'}
        </button>
      </div>

      {/* Search result label (bottom) */}
      {searchResult && (
        <div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[1000] px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{
            background: '#0f1d30dd',
            backdropFilter: 'blur(8px)',
            border: '1px solid #f59e0b40',
            color: '#fbbf24',
            maxWidth: '80%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          📍 {searchResult.name}
        </div>
      )}
    </div>
  )
}
