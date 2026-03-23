import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const { searchParams } = new URL(_req.url)
  const shopId = searchParams.get('shop_id')

  let q = s.from('customers')
    .select(`
      *,
      assets(id, unit_number, year, make, model, vin, odometer, status, unit_type, ownership_type),
      invoices(id, invoice_number, status, total, amount_paid, balance_due, due_date, created_at),
      service_orders(id, so_number, status, priority, complaint, grand_total, labor_total, parts_total, created_at, completed_at, assets(unit_number), users!assigned_tech(full_name)),
      kiosk_checkins(id, unit_number, company_name, contact_name, complaint_en, checkin_ref, status, created_at)
    `)
    .eq('id', id)

  if (shopId) q = q.eq('shop_id', shopId)

  const { data, error } = await q.single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const body = await req.json()

  const updateable = ['company_name', 'contact_name', 'phone', 'email', 'address', 'notes', 'customer_status', 'payment_terms', 'credit_limit', 'dot_number', 'mc_number', 'pricing_tier']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  const { data, error } = await s.from('customers').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
