import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types'

export async function getCustomers(shopId: string, search?: string): Promise<Customer[]> {
  const supabase = createClient()
  let q = supabase.from('customers').select('*').eq('shop_id', shopId).order('company_name')
  if (search) q = q.ilike('company_name', `%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as Customer[]
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = createClient()
  const { data } = await supabase.from('customers').select('*').eq('id', id).single()
  return data as Customer | null
}

export async function searchCustomers(shopId: string, query: string): Promise<Customer[]> {
  const supabase = createClient()
  const { data } = await supabase.from('customers').select('id, company_name, contact_name, phone').eq('shop_id', shopId).ilike('company_name', `%${query}%`).limit(10)
  return (data || []) as Customer[]
}
