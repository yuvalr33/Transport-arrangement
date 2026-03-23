'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Customer, CustomerAddress } from '@/types'
import {
    getAllCustomers, getCustomer, upsertCustomer,
    deleteCustomer, upsertAddress, removeAddress, newAddrId,
} from '@/lib/customerDb'
import { MapPicker } from './MapPicker'

// ─── empty defaults ───────────────────────────────────────────────────────────
function emptyCustomer(): Customer {
    return { code: '', name: '', addresses: [], time_from: '', time_to: '', notes: '' }
}

// ─── Address row ──────────────────────────────────────────────────────────────
function AddressRow({
    addr, onEdit, onDelete,
}: {
    addr: CustomerAddress
    onEdit: () => void
    onDelete: () => void
}) {
    return (
        <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all group"
            style={{ background: '#ffffff06', border: '1px solid #1e2d45' }}
        >
            <span className="text-sm shrink-0">📍</span>
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-300 truncate">{addr.label || 'כתובת'}</div>
                <div className="text-[10px] text-slate-500 truncate">{addr.address_text}</div>
                <div className="text-[10px] text-slate-700">{addr.lat.toFixed(4)}, {addr.lng.toFixed(4)}</div>
            </div>
            <button
                onClick={onEdit}
                className="shrink-0 text-[11px] px-2 py-1 rounded-lg border border-border text-slate-500 hover:text-blue-300 hover:border-blue-500/40 transition-all"
            >
                ✏️ ערוך
            </button>
            <button
                onClick={onDelete}
                className="shrink-0 text-[11px] px-2 py-1 rounded-lg border border-border text-slate-500 hover:text-red-400 hover:border-red-500/40 transition-all"
            >
                🗑️
            </button>
        </div>
    )
}

// ─── Customer form panel ──────────────────────────────────────────────────────
function CustomerForm({
    initial,
    isNew,
    onSave,
    onDelete,
    onClose,
}: {
    initial: Customer
    isNew: boolean
    onSave: (c: Customer, oldCode?: string) => void
    onDelete: () => void
    onClose: () => void
}) {
    const [form, setForm] = useState<Customer>({ ...initial, addresses: [...initial.addresses] })
    const [pickerFor, setPickerFor] = useState<{ addr: CustomerAddress | null; isNew: boolean } | null>(null)
    const [addrLabel, setAddrLabel] = useState('')
    const [deleteConfirm, setDeleteConfirm] = useState(false)
    const [codeError, setCodeError] = useState('')

    const set = (k: keyof Customer, v: any) => setForm(p => ({ ...p, [k]: v }))

    const handleSave = () => {
        if (!form.code.trim()) { setCodeError('קוד לקוח הוא שדה חובה'); return }
        if (!form.name.trim()) return
        onSave(form, !isNew && form.code !== initial.code ? initial.code : undefined)
    }

    const handlePickerConfirm = (lat: number, lng: number, label: string) => {
        if (!pickerFor) return
        const isNewAddr = pickerFor.isNew
        const existingAddr = pickerFor.addr

        if (isNewAddr) {
            const newAddr: CustomerAddress = {
                id: newAddrId(),
                label: addrLabel.trim() || 'כתובת',
                address_text: label,
                lat, lng,
            }
            setForm(p => ({ ...p, addresses: [...p.addresses, newAddr] }))
        } else if (existingAddr) {
            setForm(p => ({
                ...p,
                addresses: p.addresses.map(a =>
                    a.id === existingAddr.id ? { ...a, lat, lng, address_text: label } : a
                ),
            }))
        }
        setPickerFor(null)
        setAddrLabel('')
    }

    const handleRemoveAddr = (id: string) => {
        setForm(p => ({ ...p, addresses: p.addresses.filter(a => a.id !== id) }))
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Form header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0" style={{ background: '#0a1525' }}>
                <span className="text-lg">{isNew ? '➕' : '✏️'}</span>
                <div className="flex-1 font-black text-sm text-slate-200">
                    {isNew ? 'לקוח חדש' : `עריכה: ${initial.name}`}
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" dir="rtl">
                {/* Basic info */}
                <div className="space-y-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">פרטי לקוח</div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] text-slate-500 mb-1">קוד לקוח *</label>
                            <input
                                className="input text-sm"
                                value={form.code}
                                onChange={e => { set('code', e.target.value); setCodeError('') }}
                                placeholder="למשל: 1234"
                            />
                            {codeError && <div className="text-[10px] text-red-400 mt-1">{codeError}</div>}
                        </div>
                        <div>
                            <label className="block text-[11px] text-slate-500 mb-1">שם לקוח *</label>
                            <input
                                className="input text-sm"
                                value={form.name}
                                onChange={e => set('name', e.target.value)}
                                placeholder="שם מלא..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] text-slate-500 mb-1">⏰ החל משעה</label>
                            <input type="time" className="input text-sm"
                                value={form.time_from ?? ''}
                                onChange={e => set('time_from', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[11px] text-slate-500 mb-1">⏰ עד שעה</label>
                            <input type="time" className="input text-sm"
                                value={form.time_to ?? ''}
                                onChange={e => set('time_to', e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] text-slate-500 mb-1">הערות</label>
                        <textarea
                            className="input text-sm resize-none"
                            rows={2}
                            value={form.notes ?? ''}
                            onChange={e => set('notes', e.target.value)}
                            placeholder="הערות קבועות על הלקוח..."
                        />
                    </div>
                </div>

                {/* Addresses */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            כתובות ({form.addresses.length})
                        </div>
                    </div>

                    {form.addresses.length === 0 && (
                        <div className="text-[11px] text-slate-600 py-2 text-center">
                            אין כתובות — הוסף כתובת למטה
                        </div>
                    )}

                    <div className="space-y-1.5">
                        {form.addresses.map(addr => (
                            <AddressRow
                                key={addr.id}
                                addr={addr}
                                onEdit={() => setPickerFor({ addr, isNew: false })}
                                onDelete={() => handleRemoveAddr(addr.id)}
                            />
                        ))}
                    </div>

                    {/* Add address */}
                    <div className="flex gap-2 mt-2">
                        <input
                            className="input text-xs flex-1"
                            placeholder="תווית לכתובת (למשל: מחסן, חנות ראשית...)"
                            value={addrLabel}
                            onChange={e => setAddrLabel(e.target.value)}
                        />
                        <button
                            className="btn-ghost text-sm shrink-0"
                            onClick={() => setPickerFor({ addr: null, isNew: true })}
                        >
                            📍 הוסף
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer buttons */}
            <div className="p-4 border-t border-border space-y-2 shrink-0">
                <button
                    className="btn-primary w-full text-sm"
                    onClick={handleSave}
                    disabled={!form.name.trim() || !form.code.trim()}
                >
                    💾 שמור לקוח
                </button>

                {!isNew && (
                    deleteConfirm ? (
                        <div className="flex gap-2">
                            <button className="btn-ghost flex-1 text-sm" onClick={() => setDeleteConfirm(false)}>ביטול</button>
                            <button
                                className="flex-1 text-sm btn"
                                style={{ background: '#ef444420', color: '#f87171', border: '1px solid #ef444440' }}
                                onClick={onDelete}
                            >
                                אשר מחיקה
                            </button>
                        </div>
                    ) : (
                        <button
                            className="btn-ghost w-full text-sm text-red-400/60 hover:text-red-400"
                            onClick={() => setDeleteConfirm(true)}
                        >
                            🗑️ מחק לקוח
                        </button>
                    )
                )}
            </div>

            {/* Map picker */}
            {pickerFor && (
                <MapPicker
                    initialQuery={pickerFor.addr?.address_text ?? form.name}
                    initialLat={pickerFor.addr?.lat}
                    initialLng={pickerFor.addr?.lng}
                    onConfirm={handlePickerConfirm}
                    onClose={() => { setPickerFor(null); setAddrLabel('') }}
                />
            )}
        </div>
    )
}

// ─── Main CustomerManager ─────────────────────────────────────────────────────
export function CustomerManager({ onClose }: { onClose: () => void }) {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Customer | null>(null)
    const [isNew, setIsNew] = useState(false)

    const reload = useCallback(async () => {
        const list = await getAllCustomers()
        setCustomers(list.sort((a, b) => a.name.localeCompare(b.name, 'he')))
    }, [])

    useEffect(() => { reload() }, [reload])

    const handleSave = async (c: Customer, oldCode?: string) => {
        await upsertCustomer(c, oldCode)
        await reload()
        setSelected(c)
        setIsNew(false)
    }

    const handleDelete = async () => {
        if (!selected) return
        await deleteCustomer(selected.code)
        await reload()
        setSelected(null)
        setIsNew(false)
    }

    const handleNew = () => {
        setSelected(null)
        setIsNew(true)
    }

    const filtered = customers.filter(c =>
        c.name.includes(search) ||
        c.code.includes(search) ||
        c.addresses.some(a => a.address_text.includes(search))
    )

    return (
        <div
            className="fixed inset-0 z-[8000] flex"
            style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
        >
            <div
                className="flex h-full w-full max-w-5xl mx-auto shadow-2xl overflow-hidden rounded-none sm:rounded-2xl sm:my-4"
                style={{ background: '#0a1525', border: '1px solid #1e2d45' }}
            >
                {/* ── Left: customer list ── */}
                <div className="w-72 shrink-0 flex flex-col border-l border-border" style={{ background: '#060e1a' }}>
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
                        <span className="text-lg">👥</span>
                        <div className="flex-1 font-black text-sm text-slate-200">מאגר לקוחות</div>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
                    </div>

                    {/* Search */}
                    <div className="p-3 border-b border-border shrink-0">
                        <input
                            className="input text-sm"
                            placeholder="חיפוש לקוח..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            dir="rtl"
                        />
                    </div>

                    {/* Stats bar */}
                    <div className="px-4 py-2 border-b border-border shrink-0 flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">{customers.length} לקוחות במאגר</span>
                        <div className="flex-1" />
                        <button
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
                            style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}
                            onClick={handleNew}
                        >
                            + חדש
                        </button>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto" dir="rtl">
                        {filtered.length === 0 && (
                            <div className="text-center text-slate-600 text-xs py-8">
                                {search ? 'לא נמצאו תוצאות' : 'אין לקוחות במאגר'}
                            </div>
                        )}
                        {filtered.map(c => (
                            <button
                                key={c.code}
                                onClick={() => { setSelected(c); setIsNew(false) }}
                                className="w-full text-right px-4 py-2.5 border-b transition-all hover:bg-white/4"
                                style={{
                                    borderColor: '#0f1d30',
                                    background: selected?.code === c.code ? '#f59e0b12' : 'transparent',
                                    borderRight: selected?.code === c.code ? '3px solid #f59e0b' : '3px solid transparent',
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-slate-200 truncate">{c.name}</div>
                                        <div className="flex gap-2 mt-0.5">
                                            <span className="text-[10px] text-slate-600">{c.code}</span>
                                            {c.addresses.length > 0 && (
                                                <span className="text-[10px] text-green-600">
                                                    📍 {c.addresses.length} כתובת{c.addresses.length > 1 ? 'ות' : ''}
                                                </span>
                                            )}
                                            {c.addresses.length === 0 && (
                                                <span className="text-[10px] text-red-500">⚠️ ללא כתובת</span>
                                            )}
                                        </div>
                                    </div>
                                    {(c.time_from || c.time_to) && (
                                        <span className="text-[9px] text-blue-400 shrink-0">⏰</span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Right: form ── */}
                <div className="flex-1 overflow-hidden" style={{ background: '#0f1d30' }}>
                    {(selected || isNew) ? (
                        <CustomerForm
                            key={isNew ? '__new__' : selected!.code}
                            initial={isNew ? emptyCustomer() : selected!}
                            isNew={isNew}
                            onSave={handleSave}
                            onDelete={handleDelete}
                            onClose={() => { setSelected(null); setIsNew(false) }}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-4">
                            <div className="text-6xl">👥</div>
                            <div className="text-center">
                                <div className="font-bold text-lg text-slate-500">בחר לקוח מהרשימה</div>
                                <div className="text-sm mt-1">או לחץ על "+ חדש" להוסיף לקוח</div>
                            </div>
                            <button className="btn-primary text-sm" onClick={handleNew}>
                                ➕ הוסף לקוח חדש
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
