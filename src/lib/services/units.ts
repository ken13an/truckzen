import { createClient } from '@/lib/supabase/client'
import type { Unit } from '@/types'

export async function getUnits(shopId: string, customerId?: string): Promise<Unit[]> {
  const supabase = createClient()
  let q = supabase.from('assets').select('*, customers(company_name)').eq('shop_id', shopId).is('deleted_at', null).order('unit_number')
  if (customerId) q = q.eq('customer_id', customerId)
  const { data } = await q
  return (data || []) as Unit[]
}

export async function getUnit(id: string): Promise<Unit | null> {
  const supabase = createClient()
  const { data } = await supabase.from('assets').select('*, customers(company_name)').eq('id', id).single()
  return data as Unit | null
}

export async function searchUnits(shopId: string, query: string, customerId?: string): Promise<Unit[]> {
  const supabase = createClient()
  let q = supabase.from('assets').select('id, unit_number, year, make, model, vin, unit_type').eq('shop_id', shopId).is('deleted_at', null).ilike('unit_number', `%${query}%`).limit(10)
  if (customerId) q = q.eq('customer_id', customerId)
  const { data } = await q
  return (data || []) as Unit[]
}
