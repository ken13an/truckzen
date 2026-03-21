import { createClient } from '@/lib/supabase/client'
import type { Invoice, InvoiceStatus } from '@/types'

export async function getInvoices(shopId: string, status?: InvoiceStatus): Promise<Invoice[]> {
  const supabase = createClient()
  let q = supabase.from('invoices').select('*, customers(company_name), service_orders(so_number, assets(unit_number))').eq('shop_id', shopId).order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data } = await q
  return (data || []) as Invoice[]
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = createClient()
  const { data } = await supabase.from('invoices').select('*, customers(company_name, contact_name, phone, email, address, city, state, zip), service_orders(so_number, assets(unit_number, year, make, model))').eq('id', id).single()
  return data as Invoice | null
}
