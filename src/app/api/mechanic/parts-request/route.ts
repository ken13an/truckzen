import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'

const VIEWABLE_STATUSES = ['requested', 'reviewing', 'submitted', 'partial', 'ready', 'ordered', 'picked_up']

export async function GET(_req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.shopId || !ctx.admin || !ctx.actor) return ctx.error!

  let q = ctx.admin.from('parts_requests')
    .select('*')
    .eq('shop_id', ctx.shopId)
    .eq('requested_by', ctx.actor.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!ctx.actor.is_platform_owner) q = q.in('status', VIEWABLE_STATUSES)
  const { data, error } = await q.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.shopId || !ctx.admin || !ctx.actor) return ctx.error!

  const { so_id, so_line_id, part_name, quantity, notes } = await req.json()
  if (!part_name?.trim()) return NextResponse.json({ error: 'part_name required' }, { status: 400 })

  let linkedSoId = so_id || null
  if (so_line_id && !linkedSoId) {
    const { data: line } = await ctx.admin.from('so_lines').select('so_id, service_order_id').eq('id', so_line_id).single()
    linkedSoId = line?.so_id || line?.service_order_id || null
  }
  if (linkedSoId) {
    const { data: wo } = await ctx.admin.from('service_orders').select('id, shop_id').eq('id', linkedSoId).single()
    if (!wo || wo.shop_id !== ctx.shopId) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
  }

  const { data, error } = await ctx.admin.from('parts_requests').insert({
    shop_id: ctx.shopId,
    so_id: linkedSoId,
    so_line_id: so_line_id || null,
    requested_by: ctx.actor.id,
    description: part_name.trim(),
    part_name: part_name.trim(),
    quantity: quantity || 1,
    notes: notes || null,
    status: 'requested',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'parts_manager', 'parts_clerk', 'office_admin', 'floor_manager'])
  if (ctx.error || !ctx.shopId || !ctx.admin || !ctx.actor) return ctx.error!

  const { id, status, rejected_reason, in_stock } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: existing } = await ctx.admin.from('parts_requests').select('id, shop_id').eq('id', id).single()
  if (!existing || existing.shop_id !== ctx.shopId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (status) update.status = status
  if (status && ['ready', 'ordered', 'picked_up'].includes(status)) update[`${status}_at`] = new Date().toISOString()
  if (rejected_reason) update.rejected_reason = rejected_reason
  if (in_stock !== undefined) update.in_stock = in_stock
  if (['reviewing', 'submitted', 'partial', 'ready', 'ordered'].includes(status)) {
    update.approved_by_user_id = ctx.actor.id
    update.approved_at = new Date().toISOString()
  }

  const { error } = await ctx.admin.from('parts_requests').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
