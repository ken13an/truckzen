import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('customers')
    .select('*, assets(id, unit_number, year, make, model, status), invoices(id, invoice_number, status, total, balance_due, created_at)')
    .eq('id', id)
    .eq('shop_id', user.shop_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','service_advisor','service_writer','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const updateable = ['company_name','contact_name','phone','email','address','city','state','zip','payment_terms','notes']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  const { data, error } = await supabase.from('customers').update(update).eq('id', id).eq('shop_id', user.shop_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['owner','gm','it_person'].includes(user.role))
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  // Soft delete — flag inactive, never hard delete (invoices reference customer)
  await supabase.from('customers').update({ active: false }).eq('id', id).eq('shop_id', user.shop_id)
  return NextResponse.json({ success: true })
}
