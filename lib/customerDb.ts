import type { Customer, CustomerAddress } from '@/types'

const DB_KEY = 'hagla_customers_v1'

function load(): Record<string, Customer> {
    if (typeof window === 'undefined') return {}
    try {
        return JSON.parse(localStorage.getItem(DB_KEY) || '{}')
    } catch { return {} }
}

function save(db: Record<string, Customer>) {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
}

/** Get all customers as array */
export function getAllCustomers(): Customer[] {
    return Object.values(load())
}

/** Lookup a single customer by code */
export function getCustomer(code: string): Customer | null {
    return load()[code] ?? null
}

/** Normalise string for name matching */
function norm(s: string) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Find a customer by code (exact) OR by name (normalised).
 * Returns { customer, matchedBy } so callers know how it matched.
 */
export function findCustomer(
    code: string,
    name: string
): { customer: Customer; matchedBy: 'code' | 'name' } | null {
    const db = load()
    // 1️⃣ Exact code match
    if (db[code]) return { customer: db[code], matchedBy: 'code' }
    // 2️⃣ Name match (normalised)
    const normName = norm(name)
    const byName = Object.values(db).find(c => norm(c.name) === normName)
    if (byName) return { customer: byName, matchedBy: 'name' }
    return null
}

/** Upsert a customer (create or overwrite) */
export function upsertCustomer(customer: Customer) {
    const db = load()
    db[customer.code] = customer
    save(db)
}

/** Add/replace an address on a customer */
export function upsertAddress(code: string, addr: CustomerAddress) {
    const db = load()
    if (!db[code]) return
    const idx = db[code].addresses.findIndex(a => a.id === addr.id)
    if (idx >= 0) db[code].addresses[idx] = addr
    else db[code].addresses.push(addr)
    save(db)
}

/** Remove an address from a customer */
export function removeAddress(code: string, addrId: string) {
    const db = load()
    if (!db[code]) return
    db[code].addresses = db[code].addresses.filter(a => a.id !== addrId)
    save(db)
}

/** Delete a customer entirely */
export function deleteCustomer(code: string) {
    const db = load()
    delete db[code]
    save(db)
}

/** Generate a new unique address ID */
export function newAddrId(): string {
    return `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
