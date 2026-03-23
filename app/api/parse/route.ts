import { NextRequest, NextResponse } from 'next/server'
import { parseExcel } from '@/lib/excel'

/**
 * POST /api/parse
 * Accepts a multipart form with a .xlsx file.
 * Returns the parsed rows (with code, name, carts, times, notes, address text).
 * NO geocoding — that is resolved on the client via the customer DB + map picker.
 */
export async function POST(req: NextRequest) {
    try {
        const form = await req.formData()
        const file = form.get('file') as File | null
        if (!file) return NextResponse.json({ error: 'לא נשלח קובץ' }, { status: 400 })

        let rows
        try {
            rows = parseExcel(await file.arrayBuffer())
        } catch (e: any) {
            return NextResponse.json({ error: e.message }, { status: 400 })
        }

        if (!rows.length) {
            return NextResponse.json({ error: 'הקובץ ריק — לא נמצאו שורות' }, { status: 400 })
        }

        return NextResponse.json({ rows })
    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ error: e.message || 'שגיאת שרת' }, { status: 500 })
    }
}
