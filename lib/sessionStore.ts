/**
 * Session store — persists manual overrides for the current calendar day.
 * On a new day the old data is discarded automatically.
 */
import type { ReviewEntry } from '@/types'

const SESSION_KEY = 'hagla_session_v1'

function todayStr(): string {
    return new Date().toISOString().slice(0, 10)
}

/** Per-entry field overrides saved for today (address, times, carts, notes) */
export interface EntryOverride {
    lat?: number
    lng?: number
    address_text?: string
    time_from?: string
    time_to?: string
    carts?: number
    notes?: string
}

interface SessionData {
    date: string
    /** Manual extra entries (not from Excel) */
    manualEntries: ReviewEntry[]
    /** Per-code overrides for ANY field (address, times, carts…) */
    entryOverrides: Record<string, EntryOverride>
    /** IDs of pickups selected for today's routing */
    selectedPickupIds: string[]
}

function load(): SessionData {
    if (typeof window === 'undefined') {
        return { date: todayStr(), manualEntries: [], entryOverrides: {}, pickups: [] }
    }
    try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) throw new Error('empty')
        const data = JSON.parse(raw) as any
        if (data.date !== todayStr()) throw new Error('stale')
        // Migrate old shape
        if (!data.entryOverrides && data.addressOverrides) {
            const migrated: Record<string, EntryOverride> = {}
            for (const [k, v] of Object.entries(data.addressOverrides as any)) {
                migrated[k] = v as EntryOverride
            }
            data.entryOverrides = migrated
            delete data.addressOverrides
        }
        if (!data.entryOverrides) data.entryOverrides = {}
        if (!data.selectedPickupIds) data.selectedPickupIds = []
        // Migrate old full pickup objects to just IDs
        if (data.pickups && !data.selectedPickupIds?.length) {
            data.selectedPickupIds = (data.pickups as any[]).filter(p => p.selected).map((p: any) => p.id)
            delete data.pickups
        }
        return data as SessionData
    } catch {
        return { date: todayStr(), manualEntries: [], entryOverrides: {}, selectedPickupIds: [] }
    }
}

function save(data: SessionData) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

function empty(): SessionData {
    return { date: todayStr(), manualEntries: [], entryOverrides: {}, selectedPickupIds: [] }
}

// ─── Manual entries ───────────────────────────────────────────────────────────

export function getManualEntries(): ReviewEntry[] {
    return load().manualEntries
}

export function upsertManualEntry(entry: ReviewEntry) {
    const data = load()
    const idx = data.manualEntries.findIndex(e => e.code === entry.code)
    if (idx >= 0) data.manualEntries[idx] = entry
    else data.manualEntries.push(entry)
    save(data)
}

export function removeManualEntry(code: string) {
    const data = load()
    data.manualEntries = data.manualEntries.filter(e => e.code !== code)
    save(data)
}

// ─── Entry overrides (address + times + carts + notes) ────────────────────────

export function getEntryOverrides(): Record<string, EntryOverride> {
    return load().entryOverrides
}

/** Merge a partial override for a customer (only sets provided keys) */
export function setEntryOverride(code: string, patch: EntryOverride) {
    const data = load()
    data.entryOverrides[code] = { ...(data.entryOverrides[code] ?? {}), ...patch }
    save(data)
}

export function clearEntryOverride(code: string) {
    const data = load()
    delete data.entryOverrides[code]
    save(data)
}

// ─── Keep old address-specific helpers as thin wrappers ───────────────────────

/** @deprecated use setEntryOverride */
export function getAddressOverrides(): Record<string, { lat: number; lng: number; address_text: string }> {
    const overrides = load().entryOverrides
    const result: Record<string, { lat: number; lng: number; address_text: string }> = {}
    for (const [k, v] of Object.entries(overrides)) {
        if (v.lat !== undefined && v.lng !== undefined && v.address_text !== undefined) {
            result[k] = { lat: v.lat, lng: v.lng, address_text: v.address_text }
        }
    }
    return result
}

/** @deprecated use setEntryOverride */
export function setAddressOverride(code: string, lat: number, lng: number, address_text: string) {
    setEntryOverride(code, { lat, lng, address_text })
}

// ─── Cancelled entries (ביטולים יומיים) ──────────────────────────────────────

/** Mark an entry as cancelled for today (will be excluded from build) */
export function cancelEntry(code: string) {
    const data = load()
    // Store under a dedicated key
    if (!data.entryOverrides[`__cancelled__${code}`]) {
        data.entryOverrides[`__cancelled__${code}`] = {}
    }
    save(data)
}

/** Restore a cancelled entry */
export function restoreEntry(code: string) {
    const data = load()
    delete data.entryOverrides[`__cancelled__${code}`]
    save(data)
}

/** Get the set of all cancelled codes today */
export function getCancelledCodes(): Set<string> {
    const overrides = load().entryOverrides
    const codes = new Set<string>()
    for (const key of Object.keys(overrides)) {
        if (key.startsWith('__cancelled__')) codes.add(key.slice('__cancelled__'.length))
    }
    return codes
}

// ─── Selected pickup IDs for today's routing ──────────────────────────────────────

export function getSelectedPickupIds(): Set<string> {
    return new Set(load().selectedPickupIds)
}

export function setPickupSelected(id: string, selected: boolean) {
    const data = load()
    const ids = new Set(data.selectedPickupIds)
    if (selected) ids.add(id)
    else ids.delete(id)
    data.selectedPickupIds = Array.from(ids)
    save(data)
}

export function isPickupSelected(id: string): boolean {
    return load().selectedPickupIds.includes(id)
}

/** For routing: get selected IDs as array */
export function getSelectedPickupIdsArray(): string[] {
    return load().selectedPickupIds
}
