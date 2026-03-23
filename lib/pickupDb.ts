/**
 * pickupDb.ts — permanent pickup records with completion history.
 * Stored in localStorage, never expires.
 */
import type { PickupRecord, PickupCompletion } from '@/types'

const KEY = 'hagla_pickups_v1'

function todayStr(): string {
    return new Date().toISOString().slice(0, 10)
}

type Db = Record<string, PickupRecord>

function load(): Db {
    if (typeof window === 'undefined') return {}
    try {
        const raw = localStorage.getItem(KEY)
        return raw ? JSON.parse(raw) : {}
    } catch {
        return {}
    }
}

function save(db: Db) {
    localStorage.setItem(KEY, JSON.stringify(db))
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export function getAllPickupRecords(): PickupRecord[] {
    return Object.values(load())
}

export function getPickupRecord(id: string): PickupRecord | null {
    return load()[id] ?? null
}

export function upsertPickupRecord(record: PickupRecord) {
    const db = load()
    db[record.id] = record
    save(db)
}

export function deletePickupRecord(id: string) {
    const db = load()
    delete db[id]
    save(db)
}

export function newPickupRecordId(): string {
    return `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ─── Completion tracking ───────────────────────────────────────────────────────

/** Mark a pickup as done (or not done) for today. Replaces today's entry if exists. */
export function markPickupDone(id: string, done: boolean, note?: string) {
    const db = load()
    const record = db[id]
    if (!record) return
    const today = todayStr()
    // Remove any existing entry for today
    record.completions = record.completions.filter(c => c.date !== today)
    // Add new one
    const completion: PickupCompletion = { date: today, done, note }
    record.completions.unshift(completion)  // newest first
    save(db)
}

/** Get today's completion status for a pickup */
export function getTodayCompletion(record: PickupRecord): PickupCompletion | null {
    const today = todayStr()
    return record.completions.find(c => c.date === today) ?? null
}

/** Get completions for a specific record, optionally limited */
export function getRecentCompletions(record: PickupRecord, limit = 10): PickupCompletion[] {
    return record.completions.slice(0, limit)
}
