import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'

type P = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const requestedShopId = new URL(req.url).searchParams.get('shop_id')
  let q = ctx.admin.from('customers').select(`
    *,
    assets(id, unit_number, year, make, model, vin, odometer, status, unit_type, ownership_type),
    service_orders(id, so_number, status, priority, complaint, grand_total, labor_total, parts_total, created_at, completed_at),
    kiosk_checkins(id, unit_number, company_name, contact_name, complaint_en, checkin_ref, status, created_at)
  `).eq('id', id)
  if (ctx.actor.is_platform_owner && requestedShopId) q = q.eq('shop_id', requestedShopId)
  else if (ctx.shopId) q = q.eq('shop_id', ctx.shopId)
  const { data, error } = await q.single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const body = await req.json().catch(() => null)
  const { data: existing } = await ctx.admin.from('customers').select('id, shop_id').eq('id', id).single()
  if (!existing || (!ctx.actor.is_platform_owner && existing.shop_id !== ctx.shopId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updateable = ['company_name', 'contact_name', 'phone', 'email', 'address', 'notes', 'customer_status', 'payment_terms', 'credit_limit', 'dot_number', 'mc_number', 'pricing_tier', 'default_ownership_type']
  const update: Record<string, any> = {}
  for (const f of updateable) {
    if (body?.[f] !== undefined) update[f] = body[f]
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  const { data, error } = await ctx.admin.from('customers').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
