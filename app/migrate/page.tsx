"use client"
import { useState } from 'react'
import { getLocalCustomers, getLocalPickups } from '@/lib/localMigration'
import { supabase } from '@/lib/supabase'

export default function MigratePage() {
    const [status, setStatus] = useState('מצב שגרה (Standby)')
    const [logs, setLogs] = useState<string[]>([])

    const processMigration = async () => {
        try {
            setStatus('⏳ מתחיל להגר לקוחות...')
            const customers = getLocalCustomers()
            for (const c of customers) {
                // insert customer
                const { error: cErr } = await supabase.from('customers').upsert({
                    code: c.code,
                    name: c.name,
                    time_from: c.time_from || null,
                    time_to: c.time_to || null,
                    notes: c.notes || null
                })
                if (cErr) throw new Error(`Customer ${c.code} error: ${cErr.message}`)
                
                // insert addresses
                for (const a of c.addresses) {
                    const { error: aErr } = await supabase.from('customer_addresses').upsert({
                        id: a.id,
                        customer_code: c.code,
                        label: a.label,
                        address_text: a.address_text,
                        lat: a.lat,
                        lng: a.lng
                    })
                    if (aErr) throw new Error(`Address ${a.id} error: ${aErr.message}`)
                }
            }
            setLogs(prev => [...prev, `העברתי בהצלחה ${customers.length} לקוחות (כולל הכתובות השונות שלהם).`])

            setStatus('⏳ ממשיך להעביר איסופים קבועים...')
            const pickups = getLocalPickups()
            for (const p of pickups) {
                // insert pickup
                const { error: pErr } = await supabase.from('pickups').upsert({
                    id: p.id,
                    name: p.name,
                    address_text: p.address_text,
                    lat: p.lat || null,
                    lng: p.lng || null,
                    what_to_collect: p.what_to_collect,
                    phone: p.phone || null,
                    notes: p.notes || null,
                })
                if (pErr) throw new Error(`Pickup ${p.id} error: ${pErr.message}`)

                // insert completions (history)
                for (const pc of p.completions) {
                    const { error: pcErr } = await supabase.from('pickup_completions').upsert({
                        pickup_id: p.id,
                        date: pc.date,
                        done: pc.done,
                        note: pc.note || null
                    })
                    if (pcErr) throw new Error(`Completion ${pc.date} error: ${pcErr.message}`)
                }
            }
            setLogs(prev => [...prev, `העברתי בהצלחה ${pickups.length} איסופים קבועים והיסטוריות ביצוע.`])

            setStatus('הפעולה הסתיימה בהצלחה! ✅ הנתונים עברו בשלמותם ל-Supabase.')
        } catch (e: any) {
            setStatus(`הייתה שגיאה: ${e.message}`)
            console.error(e)
        }
    }

    return (
        <div className="p-10 max-w-3xl mx-auto" dir="rtl">
            <h1 className="text-2xl font-bold mb-4">העברת נתונים ל-Supabase</h1>
            <p className="mb-6 text-gray-600">
                עמוד רשמי וזמני להגירת כל הלקוחות והאיסופים שיש לך ב-Local Storage בתוך המחשב הקיים, ולשפוך אותם לפרויקט שפתח ב-Supabase בענן.
            </p>
            
            <button 
                onClick={processMigration}
                className="bg-blue-600 hover:bg-blue-700 transition text-white px-6 py-2 rounded shadow font-medium mb-4 disabled:bg-gray-400"
                disabled={status.includes('⏳')}
            >
                לחץ כאן כדי להתחיל את ההעברה
            </button>
            
            <div className="mt-4 p-4 bg-gray-100 rounded text-lg">
                <strong>סטטוס:</strong> {status}
            </div>
            
            <ul className="mt-4 border-t pt-4 text-sm text-gray-700 space-y-2">
                {logs.map((L, i) => <li key={i}>✓ {L}</li>)}
            </ul>
        </div>
    )
}
