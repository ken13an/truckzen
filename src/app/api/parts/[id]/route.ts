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

  const s = db()
  const { data, error } = await s
    .from('parts')
    .select('*')
    .eq('id', id)
    .eq('shop_id', shopId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Aggregate per-part movement state across non-canceled live so_lines
  // matching this part_number for this shop. The aggregation keys on
  // part_number because so_lines has no part_id FK; for shops with
  // duplicate part_number rows this value will be the same across both
  // parts rows. Always safe to read; never mutates anything.
  let movement_aggregate: { reserved: number; picked_up: number; installed: number; returned_unused: number } | null = null
  if (data.part_number) {
    const { data: rows } = await s
      .from('so_lines')
      .select('reserved_qty, picked_up_qty, installed_qty, returned_unused_qty, service_orders!inner(shop_id)')
      .eq('line_type', 'part')
      .eq('part_number', data.part_number)
      .eq('service_orders.shop_id', shopId)
      .neq('parts_status', 'canceled')
    let r = 0, p = 0, i = 0, u = 0
    for (const m of (rows || []) as Array<any>) {
      r += Number(m.reserved_qty || 0)
      p += Number(m.picked_up_qty || 0)
      i += Number(m.installed_qty || 0)
      u += Number(m.returned_unused_qty || 0)
    }
    movement_aggregate = { reserved: r, picked_up: p, installed: i, returned_unused: u }
  }

  return NextResponse.json({ ...data, movement_aggregate })
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

  // Tracked-each integer truth: coerce quantity fields to whole numbers when the
  // effective UOM is "each" and quantity tracking is on. Money/balance fields stay decimal.
  const effectiveUom = (update.uom ?? current.uom ?? 'each')
  const effectiveTrack = (update.track_quantity ?? current.track_quantity) !== false
  if (effectiveUom === 'each' && effectiveTrack) {
    for (const qf of ['on_hand', 'allocated', 'in_transit', 'min_qty', 'max_qty'] as const) {
      if (update[qf] !== undefined && update[qf] !== null) {
        const n = Number(update[qf])
        if (Number.isFinite(n)) update[qf] = Math.round(n)
      }
    }
  }

  const { data, error } = await s.from('parts').update(update).eq('id', id).eq('shop_id', shopId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateCache(`parts:${shopId}`)
  if (update.on_hand !== undefined && update.on_hand !== current.on_hand) {
    await log('parts.quantity_changed', shopId, user.id, { table:'parts', recordId:id, oldData:{ on_hand: current.on_hand }, newData:{ on_hand: update.on_hand } })
  }

  if (
    update.on_hand !== undefined &&
    Number(data.on_hand) !== Number(current.on_hand) &&
    effectiveUom === 'each' &&
    effectiveTrack !== false
  ) {
    const before_qty = Math.round(Number(current.on_hand) || 0)
    const after_qty = Math.round(Number(data.on_hand) || 0)
    const qty_delta = after_qty - before_qty
    if (qty_delta !== 0) {
      const { error: ledgerError } = await s.from('stock_movements').insert({
        shop_id: shopId,
        part_id: id,
        movement_type: 'manual_adjust',
        qty_delta,
        before_qty,
        after_qty,
        source_table: 'parts',
        source_id: id,
        actor_user_id: user.id,
        notes: null,
      })
      if (ledgerError) {
        return NextResponse.json({ error: `Ledger write failed: ${ledgerError.message}` }, { status: 500 })
      }
    }
  }

  for (const f of ['allocated', 'in_transit'] as const) {
    if (update[f] !== undefined) {
      const oldStr = String(current[f] ?? '')
      const newStr = String(data[f] ?? '')
      if (oldStr !== newStr) {
        const { error: histError } = await s.from('part_field_history').insert({
          part_id: id,
          field_name: f,
          old_value: oldStr,
          new_value: newStr,
          changed_by: user.id,
          source: 'manual_adjust',
          notes: null,
        })
        if (histError) {
          return NextResponse.json({ error: `Field history write failed (${f}): ${histError.message}` }, { status: 500 })
        }
      }
    }
  }

  for (const f of ['min_qty', 'max_qty'] as const) {
    if (update[f] !== undefined) {
      const oldStr = String(current[f] ?? '')
      const newStr = String(data[f] ?? '')
      if (oldStr !== newStr) {
        const { error: histError } = await s.from('part_field_history').insert({
          part_id: id,
          field_name: f,
          old_value: oldStr,
          new_value: newStr,
          changed_by: user.id,
          source: 'manual_adjust',
          notes: null,
        })
        if (histError) {
          return NextResponse.json({ error: `Field history write failed (${f}): ${histError.message}` }, { status: 500 })
        }
      }
    }
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
