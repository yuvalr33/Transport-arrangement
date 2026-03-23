'use client'
import { useEffect, useRef, useState } from 'react'

const HAGLA: [number, number] = [32.38639, 34.92667]
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

declare global { interface Window { L: any } }

interface Props {
    initialQuery?: string          // address text to geocode on open
    initialLat?: number | null
    initialLng?: number | null
    onConfirm: (lat: number, lng: number, label: string) => void
    onClose: () => void
}

async function geocodeQuery(q: string): Promise<[number, number] | null> {
    try {
        const url = `${NOMINATIM}?q=${encodeURIComponent(q + ', ישראל')}&format=json&limit=1&countrycodes=il`
        const r = await fetch(url, { headers: { 'User-Agent': 'HaglaRouteApp/2.0' } })
        const data = await r.json()
        if (!data?.length) return null
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
    } catch { return null }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        const r = await fetch(url, { headers: { 'User-Agent': 'HaglaRouteApp/2.0' } })
        const data = await r.json()
        return data?.display_name?.split(',').slice(0, 3).join(', ') ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}` }
}

export function MapPicker({ initialQuery, initialLat, initialLng, onConfirm, onClose }: Props) {
    const divRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<any>(null)
    const markerRef = useRef<any>(null)
    const [lat, setLat] = useState<number>(initialLat ?? HAGLA[0])
    const [lng, setLng] = useState<number>(initialLng ?? HAGLA[1])
    const [label, setLabel] = useState('')
    const [query, setQuery] = useState(initialQuery ?? '')
    const [searching, setSearching] = useState(false)
    const [ready, setReady] = useState(false)

    // ── Boot Leaflet ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!divRef.current) return
        let cancelled = false

        const boot = async () => {
            if (!window.L) {
                await new Promise<void>(res => {
                    if (document.querySelector('link[href*="leaflet"]')) { res(); return }
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
            const startLat = initialLat ?? HAGLA[0]
            const startLng = initialLng ?? HAGLA[1]

            const map = L.map(divRef.current, {
                center: [startLat, startLng],
                zoom: initialLat ? 15 : 9,
                zoomControl: true,
            })
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap © Carto', maxZoom: 19,
            }).addTo(map)

            // Draggable marker
            const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map)
            marker.on('dragend', async () => {
                const pos = marker.getLatLng()
                setLat(pos.lat)
                setLng(pos.lng)
                const lbl = await reverseGeocode(pos.lat, pos.lng)
                setLabel(lbl)
            })

            // Click on map moves marker
            map.on('click', async (e: any) => {
                marker.setLatLng(e.latlng)
                setLat(e.latlng.lat)
                setLng(e.latlng.lng)
                const lbl = await reverseGeocode(e.latlng.lat, e.latlng.lng)
                setLabel(lbl)
            })

            mapRef.current = map
            markerRef.current = marker

            if (!cancelled) {
                setReady(true)
                // If we have an initial query but no coords, geocode it
                if (initialQuery && !initialLat) {
                    doSearch(initialQuery, map, marker)
                } else {
                    // reverse geocode initial position
                    reverseGeocode(startLat, startLng).then(setLabel)
                }
            }
        }

        boot()
        return () => {
            cancelled = true
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
        }
    }, [])

    const doSearch = async (q: string, map?: any, marker?: any) => {
        if (!q.trim()) return
        setSearching(true)
        const coords = await geocodeQuery(q)
        setSearching(false)
        if (!coords) { alert('לא נמצאה כתובת — נסה להזין בצורה שונה'); return }
        const [clat, clng] = coords
        const m = marker ?? markerRef.current
        const mp = map ?? mapRef.current
        if (m && mp) {
            m.setLatLng([clat, clng])
            mp.setView([clat, clng], 16)
        }
        setLat(clat)
        setLng(clng)
        const lbl = await reverseGeocode(clat, clng)
        setLabel(lbl)
    }

    return (
        <div
            className="fixed inset-0 z-[9000] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
        >
            <div
                className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
                style={{ width: 680, maxWidth: '95vw', height: 560, maxHeight: '90vh', background: '#0f1d30', border: '1px solid #1e2d45' }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0" style={{ background: '#0a1525' }}>
                    <span className="text-xl">📍</span>
                    <div className="flex-1">
                        <div className="font-black text-sm text-slate-200">בחר מיקום על המפה</div>
                        <div className="text-[11px] text-slate-500">גרור את הסמן למיקום המדויק או לחץ על המפה</div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
                </div>

                {/* Search bar */}
                <div className="flex gap-2 px-4 py-2.5 border-b border-border shrink-0" style={{ background: '#0a1525' }}>
                    <input
                        className="input flex-1 text-sm"
                        placeholder="הזן כתובת לחיפוש..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && doSearch(query)}
                        dir="rtl"
                    />
                    <button
                        className="btn-primary px-4 py-2 text-sm"
                        onClick={() => doSearch(query)}
                        disabled={searching}
                    >
                        {searching ? '⏳' : '🔍'}
                    </button>
                </div>

                {/* Map */}
                <div ref={divRef} className="flex-1" style={{ minHeight: 0 }} />

                {/* Footer */}
                <div className="flex items-center gap-3 px-4 py-3 border-t border-border shrink-0" style={{ background: '#0a1525' }}>
                    <div className="flex-1 min-w-0">
                        {label ? (
                            <div className="text-xs text-slate-300 truncate" dir="rtl">📍 {label}</div>
                        ) : (
                            <div className="text-xs text-slate-600">המתן לטעינת המפה...</div>
                        )}
                        <div className="text-[10px] text-slate-600 mt-0.5">
                            {lat.toFixed(5)}, {lng.toFixed(5)}
                        </div>
                    </div>
                    <button
                        className="btn-ghost text-sm"
                        onClick={onClose}
                    >
                        ביטול
                    </button>
                    <button
                        className="btn-primary text-sm"
                        onClick={() => onConfirm(lat, lng, label || query)}
                        disabled={!ready}
                    >
                        ✅ אשר מיקום
                    </button>
                </div>
            </div>
        </div>
    )
}
