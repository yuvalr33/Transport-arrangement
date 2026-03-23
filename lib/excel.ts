import * as XLSX from 'xlsx'
import type { Stop } from '@/types'

function parseTime(val: unknown): string {
  if (val === null || val === undefined || val === '') return ''
  const s = String(val).trim()
  if (!s || s === 'nan') return ''
  if (/^\d{1,2}:\d{2}/.test(s)) return s.split(/[-–]/)[0].trim()
  const n = parseFloat(s)
  if (!isNaN(n) && n > 0 && n < 1) {
    const mins = Math.round(n * 1440)
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }
  return ''
}

function clean(val: unknown): string {
  if (!val) return ''
  const s = String(val).trim()
  return ['nan', 'undefined', 'null'].includes(s) ? '' : s
}

export interface ParsedRow extends Stop {
  code: string  // customer code (from column or derived from name)
}

export function parseExcel(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  if (rows.length < 2) return []

  const headers = (rows[0] as string[]).map(h => String(h ?? '').trim().toLowerCase())
  const col: Record<string, number> = {}

  headers.forEach((h, i) => {
    if (col.code === undefined && /קוד|code|מזהה|id/.test(h)) col.code = i
    if (col.name === undefined && /שם|name|לקוח|customer/.test(h)) col.name = i
    if (col.address === undefined && /כתובת|address|רחוב/.test(h)) col.address = i
    if (col.carts === undefined && /עגלה|עגלות|cart|כמות|qty|quantity/.test(h)) col.carts = i
    if (col.from === undefined && /החל|from|time_from|מ.?שעה|משעה/.test(h)) col.from = i
    if (col.to === undefined && /עד.?שעה|time_to|until|לשעה/.test(h)) col.to = i
    if (col.notes === undefined && /הערה|note|הערות/.test(h)) col.notes = i
    if (col.dir === undefined && /כיוון|direction/.test(h)) col.dir = i
  })

  if (col.name === undefined) throw new Error('לא נמצאה עמודת שם לקוח')

  const stops: ParsedRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    const name = clean(row[col.name])
    if (!name) continue

    const rawCode = col.code !== undefined ? clean(row[col.code]) : ''
    // Fallback: normalise the name as code
    const code = rawCode || name.trim().toLowerCase().replace(/\s+/g, '_')

    const cartsRaw = col.carts !== undefined ? row[col.carts] : ''
    stops.push({
      code,
      name,
      address: col.address !== undefined ? clean(row[col.address]) : '',
      carts: cartsRaw !== '' ? Math.max(0, parseInt(String(cartsRaw)) || 0) : 0,
      time_from: col.from !== undefined ? parseTime(row[col.from]) : '',
      time_to: col.to !== undefined ? parseTime(row[col.to]) : '',
      notes: col.notes !== undefined ? clean(row[col.notes]) : '',
      lat: null,
      lng: null,
    })
  }
  return stops
}

