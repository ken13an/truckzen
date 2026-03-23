import { createClient } from '@/lib/supabase/client'
import type { WorkOrder, WOLine, WOStatus } from '@/types'

const WO_SELECT = `*, customers(company_name, contact_name, phone, email), assets(unit_number, year, make, model, vin, unit_type)`

export async function getWorkOrders(shopId: string, filters?: { status?: WOStatus; search?: string }): Promise<WorkOrder[]> {
  const supabase = createClient()
  let q = supabase.from('service_orders').select(WO_SELECT).eq('shop_id', shopId).is('deleted_at', null).order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.search) q = q.or(`so_number.ilike.%${filters.search}%,concern.ilike.%${filters.search}%`)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as WorkOrder[]
}

export async function getWorkOrder(id: string): Promise<WorkOrder | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from('service_orders').select(WO_SELECT).eq('id', id).single()
  if (error) return null
  return data as WorkOrder
}

export async function getWOLines(woId: string): Promise<WOLine[]> {
  const supabase = createClient()
  const { data } = await supabase.from('so_lines').select('*').eq('service_order_id', woId).order('sort_order')
  return (data || []) as WOLine[]
}
