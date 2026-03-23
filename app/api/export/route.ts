import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import type { Route } from '@/types'

const DARK   = 'FF0F1D30'
const PANEL  = 'FF162035'
const AMBER  = 'FFF59E0B'
const WHITE  = 'FFECF0F4'
const MUTED  = 'FF94A3B8'

export async function POST(req: NextRequest) {
  const { routes, date }: { routes: Route[]; date: string } = await req.json()

  const wb = new ExcelJS.Workbook()
  wb.creator = 'מערכת קווי הובלה — חגלה'
  wb.created = new Date()

  // ── Summary sheet ──────────────────────────────────────────────────────────
  const sum = wb.addWorksheet('סיכום', { properties: { rtl: true } })
  sum.columns = [
    { key: 'name',  width: 18 },
    { key: 'dir',   width: 8  },
    { key: 'stops', width: 10 },
    { key: 'carts', width: 10 },
    { key: 'km',    width: 10 },
  ]

  // Title row
  const titleRow = sum.addRow([`קווי הובלה — ${date}`, '', '', '', ''])
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: AMBER } }
  sum.mergeCells('A1:E1')
  titleRow.height = 28
  sum.addRow([])

  // Header
  const hRow = sum.addRow(['קו', 'כיוון', 'עצירות', 'עגלות', 'ק"מ'])
  hRow.eachCell(c => {
    c.font = { bold: true, color: { argb: WHITE } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PANEL } }
    c.alignment = { horizontal: 'center', readingOrder: 'rtl' }
  })

  routes.forEach(r => {
    const row = sum.addRow([r.name, r.direction, r.stops.length, r.total_carts, r.distance_km])
    row.eachCell(c => { c.alignment = { horizontal: 'center' } })
    row.getCell(1).font = { bold: true, color: { argb: r.color.replace('#', 'FF') } }
  })

  // Totals
  sum.addRow([])
  const totRow = sum.addRow([
    `סה"כ: ${routes.length} קווים`,
    '',
    routes.reduce((a, r) => a + r.stops.length, 0),
    routes.reduce((a, r) => a + r.total_carts, 0),
    routes.reduce((a, r) => a + r.distance_km, 0).toFixed(1),
  ])
  totRow.font = { bold: true }

  // ── One sheet per route ────────────────────────────────────────────────────
  for (const route of routes) {
    const ws = wb.addWorksheet(route.name, { properties: { rtl: true } })
    ws.columns = [
      { key: 'order',   width: 5  },
      { key: 'name',    width: 28 },
      { key: 'address', width: 34 },
      { key: 'carts',   width: 8  },
      { key: 'time',    width: 16 },
      { key: 'notes',   width: 44 },
    ]

    // Route title
    const rTitle = ws.addRow([`${route.name}  ·  ${date}`, '', '', '', '', ''])
    rTitle.getCell(1).font = { bold: true, size: 14, color: { argb: route.color.replace('#','FF') } }
    rTitle.height = 24
    ws.mergeCells(`A1:F1`)

    const summary = ws.addRow([`${route.stops.length} עצירות  ·  🛒 ${route.total_carts} עגלות  ·  ~${route.distance_km} ק"מ`, '', '', '', '', ''])
    summary.getCell(1).font = { italic: true, color: { argb: MUTED } }
    ws.mergeCells(`A2:F2`)
    ws.addRow([])

    // Column headers
    const colHead = ws.addRow(['#', 'לקוח', 'כתובת', 'עגלות', 'שעות', 'הערות'])
    colHead.eachCell(c => {
      c.font = { bold: true, color: { argb: WHITE } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
      c.border = { bottom: { style: 'thin', color: { argb: 'FF1E2D45' } } }
    })

    // Hagla start
    const startRow = ws.addRow(['🏠', 'מושב חגלה — יציאה', '', '', '', ''])
    startRow.getCell(1).font = { italic: true, color: { argb: MUTED } }
    startRow.getCell(2).font = { italic: true, color: { argb: MUTED } }

    // Stops
    route.stops.forEach((s, i) => {
      const row = ws.addRow([
        s.order,
        s.name,
        s.address,
        s.carts || '',
        s.time_window || '',
        s.notes || '',
      ])
      if (i % 2 === 0) {
        row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1622' } } })
      }
      row.getCell(4).font = { bold: true, color: { argb: 'FFFCD34D' } }  // carts amber
      if (s.notes?.includes('חובה') || s.notes?.includes('⚠')) {
        row.getCell(6).font = { color: { argb: 'FFFCA5A5' } }  // red notes
      }
    })

    // Hagla end
    const endRow = ws.addRow(['🏠', 'מושב חגלה — חזרה', '', '', '', ''])
    endRow.getCell(1).font = { italic: true, color: { argb: MUTED } }
    endRow.getCell(2).font = { italic: true, color: { argb: MUTED } }
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
