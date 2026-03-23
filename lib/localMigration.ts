import type { Customer, PickupRecord } from '@/types'

export function getLocalCustomers(): Customer[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem('hagla_customers_v1')
        return Object.values(raw ? JSON.parse(raw) : {})
    } catch { return [] }
}

export function getLocalPickups(): PickupRecord[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem('hagla_pickups_v1')
        return Object.values(raw ? JSON.parse(raw) : {})
    } catch { return [] }
}
