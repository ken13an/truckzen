import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'

type P = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: P) {
  const t0 = Date.now()
  const { id } = await params
  const el = () => Date.now() - t0
  const tlog = (stage: string, extra?: Record<string, any>) => {
    const kv = extra ? Object.entries(extra).map(([k, v]) => ` ${k}=${v}`).join('') : ''
    console.log(`[customers.detail.timing.api] stage=${stage} cid=${id} elapsed_ms=${el()}${kv}`)
  }
  tlog('route_entry')

  const ctx = await requireRouteContext()
  tlog('after_requireRouteContext', { has_actor: !!ctx.actor, has_admin: !!ctx.admin, ctx_error: !!ctx.error })
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const requestedShopId = new URL(req.url).searchParams.get('shop_id')
  const shopScope = ctx.actor.is_platform_owner && requestedShopId ? requestedShopId : ctx.shopId

  // Fetch customer + assets + kiosk_checkins (small datasets)
  let q = ctx.admin.from('customers').select(`
    *,
    assets(id, unit_number, year, make, model, vin, odometer, status, unit_type, ownership_type),
    kiosk_checkins(id, unit_number, company_name, contact_name, complaint_en, checkin_ref, status, created_at)
  `).eq('id', id)
  if (shopScope) q = q.eq('shop_id', shopScope)
  tlog('before_customers_query', { shop_scope: shopScope })
  const { data, error } = await q.single()
  tlog('after_customers_query', { fail: !!error, err_code: error?.code })
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch service_orders separately with limit to prevent timeout on large history
  tlog('before_service_orders_query')
  const { data: serviceOrders, error: soError } = await ctx.admin.from('service_orders')
    .select('id, so_number, status, priority, complaint, grand_total, labor_total, parts_total, created_at, completed_at, is_historical')
    .eq('customer_id', id)
    .is('deleted_at', null)
    .neq('is_historical', true)
    .order('created_at', { ascending: false })
    .limit(100)
  tlog('after_service_orders_query', { fail: !!soError, rows: (serviceOrders || []).length })

  tlog('before_response_return')
  return NextResponse.json({ ...data, service_orders: serviceOrders || [] })
}

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext([...INVOICE_ACTION_ROLES])
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
