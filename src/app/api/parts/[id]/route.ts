import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { ADMIN_ROLES } from '@/lib/roles'
import { log } from '@/lib/security'
import { invalidateCache } from '@/lib/cache'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params;
  const user = await getAuthenticatedUserProfile()
  if (!user) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(user)
  if (!shopId) return jsonError('No shop context', 400)

  const { data, error } = await db()
    .from('parts')
    .select('*')
    .eq('id', id)
    .eq('shop_id', shopId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params;
  const user = await getAuthenticatedUserProfile()
  if (!user) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(user)
  if (!shopId) return jsonError('No shop context', 400)

  const allowed = ['owner','gm','it_person','shop_manager','parts_manager','office_admin']
  const effectiveRole = user.impersonate_role || user.role
  if (!(user.is_platform_owner && !user.impersonate_role) && !allowed.includes(effectiveRole)) return jsonError('Access denied', 403)

  const body = await req.json()
  const s = db()
  const { data: current } = await s.from('parts').select('*').eq('id', id).eq('shop_id', shopId).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateable = [
    'part_number', 'description', 'category', 'on_hand', 'reorder_point', 'cost_price', 'sell_price',
    'vendor', 'bin_location', 'core_charge', 'warranty_months',
    'uom', 'allocated', 'in_transit', 'average_cost', 'selling_price', 'cost_floor',
    'markup_percent', 'margin_percent', 'inventory_balance', 'min_qty', 'max_qty',
    'default_location', 'preferred_vendor', 'manufacturer', 'part_category', 'item_type',
    'status', 'search_tags', 'track_quantity', 'count_group', 'cogs_account',
    'fee_discount', 'shop_supply_amount', 'website_link', 'upc', 'notes', 'cross_references',
    'price_ugl_company', 'price_ugl_owner_operator', 'price_outside',
  ]
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const { data, error } = await s.from('parts').update(update).eq('id', id).eq('shop_id', shopId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateCache(`parts:${shopId}`)
  if (update.on_hand !== undefined && update.on_hand !== current.on_hand) {
    await log('parts.quantity_changed', shopId, user.id, { table:'parts', recordId:id, oldData:{ on_hand: current.on_hand }, newData:{ on_hand: update.on_hand } })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params;
  const user = await getAuthenticatedUserProfile()
  if (!user) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(user)
  if (!shopId) return jsonError('No shop context', 400)

  if (!(user.is_platform_owner && !user.impersonate_role) && !ADMIN_ROLES.includes(user.impersonate_role || user.role)) return jsonError('Access denied', 403)

  const s = db()
  const { data: part } = await s.from('parts').select('description').eq('id', id).eq('shop_id', shopId).single()
  await s.from('parts').update({ active: false, deleted_at: new Date().toISOString() }).eq('id', id).eq('shop_id', shopId)
  invalidateCache(`parts:${shopId}`)
  await log('parts.removed', shopId, user.id, { table:'parts', recordId:id, oldData: part })
  return NextResponse.json({ success: true })
}
