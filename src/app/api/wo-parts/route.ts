import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const searchParams = new URL(req.url).searchParams
  const woId = searchParams.get('wo_id')
  const lineId = searchParams.get('line_id')
  if (!woId && !lineId) return NextResponse.json({ error: 'wo_id or line_id required' }, { status: 400 })

  let effectiveWoId = woId
  if (!effectiveWoId && lineId) {
    const { data: line } = await ctx.admin.from('wo_parts').select('wo_id').eq('line_id', lineId).limit(1).single()
    effectiveWoId = (line as any)?.wo_id || null
  }
  if (!effectiveWoId) return NextResponse.json([])
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, effectiveWoId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let q = ctx.admin.from('wo_parts').select('*').eq('wo_id', effectiveWoId).order('created_at')
  if (lineId) q = q.eq('line_id', lineId)
  const { data, error } = await q.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const body = await req.json().catch(() => null)
  const { wo_id, line_id, part_number, description, quantity, unit_cost } = body || {}
  if (!wo_id || !line_id || !description) return NextResponse.json({ error: 'wo_id, line_id, description required' }, { status: 400 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, wo_id, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await ctx.admin.from('wo_parts').insert({ wo_id, line_id, part_number: part_number?.trim() || null, description: description.trim(), quantity: parseInt(quantity) || 1, unit_cost: parseFloat(unit_cost) || 0, status: 'needed' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await ctx.admin.from('wo_activity_log').insert({ wo_id, user_id: ctx.actor.id, action: `Added part: ${description.trim()}` })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const body = await req.json().catch(() => null)
  const { id, status, quantity, unit_cost, wo_id } = body || {}
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const targetWoId = wo_id || (await ctx.admin.from('wo_parts').select('wo_id').eq('id', id).single()).data?.wo_id
  if (!targetWoId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, targetWoId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const update: Record<string, any> = {}
  if (status !== undefined) update.status = status
  if (quantity !== undefined) update.quantity = parseInt(quantity)
  if (unit_cost !== undefined) update.unit_cost = parseFloat(unit_cost)
  const { data, error } = await ctx.admin.from('wo_parts').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (status) await ctx.admin.from('wo_activity_log').insert({ wo_id: targetWoId, user_id: ctx.actor.id, action: `Part status changed to ${status}` })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: part } = await ctx.admin.from('wo_parts').select('id, wo_id').eq('id', id).single()
  if (!part) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, (part as any).wo_id, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await ctx.admin.from('wo_parts').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
