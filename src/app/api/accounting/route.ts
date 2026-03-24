import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const s = db()
  const { data, error } = await s
    .from('service_orders')
    .select('id, so_number, status, invoice_status, complaint, grand_total, created_at, updated_at, accounting_notes, accounting_approved_at, accounting_approved_by, customers(id, company_name, contact_name), assets(id, unit_number, year, make, model)')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .neq('status', 'void')
    .in('invoice_status', ['pending_accounting', 'accounting_approved', 'sent_to_customer', 'quality_check_failed', 'draft'])
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
