import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import type { Route } from '@/types'

const AMBER  = 'FFF59E0B'

export async function POST(req: NextRequest) {
  const { routes, date }: { routes: Route[]; date: string } = await req.json()

  const wb = new ExcelJS.Workbook()
  wb.creator = 'מערכת קווי הובלה — חגלה'
  wb.created = new Date()

  const getRoutePickupCarts = (r: Route) => r.pickups?.reduce((a, p) => a + (p.carts !== undefined && p.carts !== '' ? Number(p.carts) : 1), 0) || 0

  const sumField = (r: Route, field: 'trays' | 'carriers' | 'boxes' | 'packages_h') =>
    r.stops.reduce((a, s) => {
      const v = (s as any)[field]
      return a + (v !== undefined && v !== '' && v !== null ? Number(v) || 0 : 0)
    }, 0)

  // ── Summary sheet ──────────────────────────────────────────────────────────
  const sum = wb.addWorksheet('סיכום', { views: [{ rightToLeft: true }] })
  sum.columns = [
    { key: 'name',     width: 18 },
    { key: 'dir',      width: 8  },
    { key: 'stops',    width: 10 },
    { key: 'trays',    width: 10 },
    { key: 'carriers', width: 10 },
    { key: 'boxes',    width: 10 },
    { key: 'carts',    width: 10 },
    { key: 'pcarts',   width: 14 },
    { key: 'km',       width: 10 },
  ]

  // Title row
  const titleRow = sum.addRow([`קווי הובלה — ${date}`, '', '', '', '', '', '', '', ''])
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: AMBER } }
  sum.mergeCells('A1:I1')
  titleRow.height = 28
  sum.addRow([])

  // Header
  const hRow = sum.addRow(['קו', 'כיוון', 'עצירות', 'מגשים', 'מנשאים', 'ארגזים', 'עגלות לחלוקה', 'עגלות לאיסוף', 'ק"מ'])
  hRow.eachCell(c => {
    c.font = { bold: true }
    c.alignment = { horizontal: 'center', readingOrder: 'rtl' }
  })

  routes.forEach(r => {
    const traysSum    = sumField(r, 'trays')
    const carriersSum = sumField(r, 'carriers')
    const boxesSum    = sumField(r, 'boxes')
    const row = sum.addRow([
      r.name, r.direction, r.stops.length,
      traysSum    || '', carriersSum || '', boxesSum || '',
      r.total_carts, getRoutePickupCarts(r), r.distance_km,
    ])
    row.eachCell(c => { c.alignment = { horizontal: 'center' } })
    row.getCell(1).font = { bold: true, color: { argb: r.color.replace('#', 'FF') } }
  })

  // Totals
  sum.addRow([])
  const totRow = sum.addRow([
    `סה"כ: ${routes.length} קווים`,
    '',
    routes.reduce((a, r) => a + r.stops.length, 0),
    routes.reduce((a, r) => a + sumField(r, 'trays'), 0)    || '',
    routes.reduce((a, r) => a + sumField(r, 'carriers'), 0) || '',
    routes.reduce((a, r) => a + sumField(r, 'boxes'), 0)    || '',
    routes.reduce((a, r) => a + r.total_carts, 0),
    routes.reduce((a, r) => a + getRoutePickupCarts(r), 0),
    routes.reduce((a, r) => a + r.distance_km, 0).toFixed(1),
  ])
  totRow.font = { bold: true }

  // ── One sheet per route ────────────────────────────────────────────────────
  for (const route of routes) {
    const ws = wb.addWorksheet(route.name, { views: [{ rightToLeft: true }] })
    ws.columns = [
      { key: 'order',   width: 5  },
      { key: 'name',    width: 28 },
      { key: 'address', width: 34 },
      { key: 'trays',   width: 8  },
      { key: 'carriers',width: 8  },
      { key: 'boxes',   width: 8  },
      { key: 'packages_h',width: 14},
      { key: 'carts',   width: 8  },
      { key: 'time',    width: 16 },
      { key: 'notes',   width: 44 },
    ]

    // Route title
    const rTitle = ws.addRow([`${route.name}  ·  ${date}`, '', '', '', '', '', '', '', '', ''])
    rTitle.getCell(1).font = { bold: true, size: 14 }
    rTitle.height = 24
    ws.mergeCells(`A1:J1`)

    const pCarts = getRoutePickupCarts(route)
    const pTxt = pCarts > 0 ? `  ·  ↩ ${pCarts} לאיסוף` : ''
    const summary = ws.addRow([`${route.stops.length} עצירות  ·  🛒 ${route.total_carts} לחלוקה${pTxt}  ·  ~${route.distance_km} ק"מ`, '', '', '', '', '', '', '', '', ''])
    summary.getCell(1).font = { italic: true }
    ws.mergeCells(`A2:J2`)
    ws.addRow([])

    // Column headers
    const colHead = ws.addRow(['#', 'לקוח', 'כתובת', 'מגשים', 'מנשאים', 'ארגזים', 'אריזות ח.ריבוי', 'עגלות', 'שעות', 'הערות'])
    colHead.eachCell(c => {
      c.font = { bold: true }
      c.border = { bottom: { style: 'thin', color: { argb: 'FF1E2D45' } } }
    })

    // Hagla start
    const startRow = ws.addRow(['🏠', 'מושב חגלה — יציאה', '', '', '', '', '', '', '', ''])
    startRow.getCell(1).font = { italic: true }
    startRow.getCell(2).font = { italic: true }

    // Stops
    route.stops.forEach((s) => {
      // For decimal numbers, format it to max 1 decimal place if it's not a whole number.
      let cartVal: number | string = s.carts || ''
      if (typeof cartVal === 'number' && !Number.isInteger(cartVal)) {
          cartVal = Math.round(cartVal * 10) / 10
      }

      const row = ws.addRow([
        s.order,
        s.name,
        s.address,
        (s as any).trays || '',
        (s as any).carriers || '',
        (s as any).boxes || '',
        (s as any).packages_h || '',
        cartVal,
        s.time_window || '',
        s.notes || '',
      ])
      row.getCell(8).font = { bold: true } // carts bold
    })

    // Hagla end
    const endRow = ws.addRow(['🏠', 'מושב חגלה — חזרה', '', '', '', '', '', '', '', ''])
    endRow.getCell(1).font = { italic: true }
    endRow.getCell(2).font = { italic: true }

    // Pickups
    if (route.pickups && route.pickups.length > 0) {
      ws.addRow([])
      const pTitle = ws.addRow(['איסופים', '', '', '', '', '', '', '', '', ''])
      pTitle.getCell(1).font = { bold: true, size: 12 }
      ws.mergeCells(`A${pTitle.number}:J${pTitle.number}`)

      route.pickups.forEach((p) => {
        let pCartVal: number | string = p.carts !== undefined && p.carts !== '' && p.carts !== null ? p.carts : 1
        if (typeof pCartVal === 'number' && !Number.isInteger(pCartVal)) {
            pCartVal = Math.round(pCartVal * 10) / 10
        }

        const row = ws.addRow([
          '↩',
          p.name,
          p.address_text,
          p.what_to_collect || '',
          '', '', '',
          pCartVal,
          '',
          p.phone ? `טלפון: ${p.phone} ${p.notes ? ' | ' + p.notes : ''}` : (p.notes || ''),
        ])
        ws.mergeCells(`D${row.number}:G${row.number}`)
        row.getCell(8).font = { bold: true }
      })
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `קווים-${date.replace(/\//g, '-')}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
