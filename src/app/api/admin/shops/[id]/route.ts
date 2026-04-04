import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.is_platform_owner) return jsonError('Access denied', 403)

  const { id: shopId } = await params
  const s = createAdminSupabaseClient()

  const { data: shop, error } = await s.from('shops').select('*').eq('id', shopId).single()
  if (error || !shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const [users, customers, assets, serviceOrders, invoices] = await Promise.all([
    s.from('users').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
    s.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
    s.from('assets').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
    s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
    s.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
  ])

  return NextResponse.json({
    ...shop,
    user_count: users.count || 0, customer_count: customers.count || 0,
    asset_count: assets.count || 0, wo_count: serviceOrders.count || 0, invoice_count: invoices.count || 0,
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.is_platform_owner) return jsonError('Access denied', 403)

  const { id: shopId } = await params
  const s = createAdminSupabaseClient()
  const body = await req.json()

  const allowed = ['name', 'dba', 'phone', 'email', 'address', 'city', 'state', 'zip', 'tax_rate', 'labor_rate', 'status']
  const filtered: Record<string, any> = {}
  for (const key of allowed) { if (key in body) filtered[key] = body[key] }

  const { data, error } = await s.from('shops').update(filtered).eq('id', shopId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.is_platform_owner) return jsonError('Access denied', 403)

  const { id: shopId } = await params
  const s = createAdminSupabaseClient()

  const { data, error } = await s.from('shops').update({ status: 'suspended' }).eq('id', shopId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
