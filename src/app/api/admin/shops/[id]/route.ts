import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function verifyPlatformOwner(s: ReturnType<typeof db>, userId: string) {
  const { data } = await s.from('users')
    .select('id, is_platform_owner')
    .eq('id', userId)
    .single()
  return data?.is_platform_owner === true
}

// GET /api/admin/shops/[id] — single shop with full stats
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = db()
  const { id: shopId } = await params
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!(await verifyPlatformOwner(s, userId))) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { data: shop, error } = await s.from('shops').select('*').eq('id', shopId).single()
  if (error || !shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  // Get counts
  const [users, customers, assets, serviceOrders, invoices] = await Promise.all([
    s.from('users').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
    s.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
    s.from('assets').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
    s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
    s.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
  ])

  return NextResponse.json({
    ...shop,
    user_count: users.count || 0,
    customer_count: customers.count || 0,
    asset_count: assets.count || 0,
    wo_count: serviceOrders.count || 0,
    invoice_count: invoices.count || 0,
  })
}

// PATCH /api/admin/shops/[id] — update shop
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = db()
  const { id: shopId } = await params
  const body = await req.json()
  const { user_id, ...updates } = body

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!(await verifyPlatformOwner(s, user_id))) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Only allow certain fields to be updated
  const allowed = ['name', 'dba', 'phone', 'email', 'address', 'city', 'state', 'zip', 'tax_rate', 'labor_rate', 'status']
  const filtered: Record<string, any> = {}
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key]
  }

  const { data, error } = await s.from('shops').update(filtered).eq('id', shopId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// DELETE /api/admin/shops/[id] — soft-delete (suspend) shop
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = db()
  const { id: shopId } = await params
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!(await verifyPlatformOwner(s, userId))) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { data, error } = await s.from('shops').update({ status: 'suspended' }).eq('id', shopId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
