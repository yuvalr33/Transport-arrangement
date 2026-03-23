import { supabase } from './supabase'
import type { Customer, CustomerAddress } from '@/types'

/** Get all customers as array */
export async function getAllCustomers(): Promise<Customer[]> {
    const { data: cData, error: cErr } = await supabase.from('customers').select('*')
    if (cErr) { console.error(cErr); return [] }

    const { data: aData, error: aErr } = await supabase.from('customer_addresses').select('*')
    if (aErr) { console.error(aErr); return [] }

    return cData.map(c => ({
        ...c,
        addresses: aData.filter(a => a.customer_code === c.code)
    }))
}

/** Lookup a single customer by code */
export async function getCustomer(code: string): Promise<Customer | null> {
    const strCode = String(code)
    const { data: c, error: cErr } = await supabase.from('customers').select('*').eq('code', strCode).maybeSingle()
    if (cErr || !c) return null

    const { data: a, error: aErr } = await supabase.from('customer_addresses').select('*').eq('customer_code', strCode)
    return { ...c, addresses: a || [] }
}

function norm(s: string) { return s.trim().toLowerCase().replace(/\s+/g, ' ') }

export async function findCustomer(
    code: string,
    name: string
): Promise<{ customer: Customer; matchedBy: 'code' | 'name' } | null> {
    const all = await getAllCustomers()

    const normName = norm(name)
    const byName = all.find(c => norm(c.name) === normName)
    if (byName) return { customer: byName, matchedBy: 'name' }

    const exact = all.find(c => String(c.code) === String(code))
    if (exact) return { customer: exact, matchedBy: 'code' }
    
    return null
}

export async function upsertCustomer(customer: Customer, oldCode?: string) {
    if (oldCode && oldCode !== customer.code) {
        await supabase.from('customers').delete().eq('code', oldCode)
    }

    await supabase.from('customers').upsert({
        code: customer.code,
        name: customer.name,
        time_from: customer.time_from || null,
        time_to: customer.time_to || null,
        notes: customer.notes || null
    })
    
    // Ensure precise sync by clear-and-replace for the addresses
    await supabase.from('customer_addresses').delete().eq('customer_code', customer.code)

    if (customer.addresses.length > 0) {
        await supabase.from('customer_addresses').insert(
            customer.addresses.map(a => ({
                id: a.id,
                customer_code: customer.code,
                label: a.label,
                address_text: a.address_text,
                lat: a.lat,
                lng: a.lng
            }))
        )
    }
}

export async function upsertAddress(code: string, addr: CustomerAddress) {
    await supabase.from('customer_addresses').upsert({
        id: addr.id,
        customer_code: code,
        label: addr.label,
        address_text: addr.address_text,
        lat: addr.lat,
        lng: addr.lng
    })
}

export async function removeAddress(code: string, addrId: string) {
    await supabase.from('customer_addresses').delete().eq('id', addrId)
}

export async function deleteCustomer(code: string) {
    await supabase.from('customers').delete().eq('code', code)
}

export function newAddrId(): string {
    return `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
