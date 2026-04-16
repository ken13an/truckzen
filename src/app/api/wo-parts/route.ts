import { SERVICE_PARTS_ROLES } from '@/lib/roles'
import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'
import { z } from 'zod'

const uuid = z.string().uuid()
const intCoerce = z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int().nonnegative())
const moneyCoerce = z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().nonnegative())

const WoPartsPostSchema = z.object({
  wo_id: uuid,
  line_id: uuid,
  part_number: z.string().max(128).optional().nullable(),
  description: z.string().trim().min(1).max(500),
  quantity: intCoerce.optional(),
  unit_cost: moneyCoerce.optional(),
}).strip()

const WoPartsPatchSchema = z.object({
  id: uuid,
  wo_id: uuid.optional(),
  status: z.string().min(1).max(64).optional(),
  quantity: intCoerce.optional(),
  unit_cost: moneyCoerce.optional(),
  expected_updated_at: z.string().datetime().optional().nullable(),
}).strip()

function badInput(zErr: z.ZodError) {
  return NextResponse.json({ error: 'Invalid payload', issues: zErr.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, { status: 400 })
}

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
  const ctx = await requireRouteContext([...SERVICE_PARTS_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const raw = await req.json().catch(() => null)
  if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const parsed = WoPartsPostSchema.safeParse(raw)
  if (!parsed.success) return badInput(parsed.error)
  const { wo_id, line_id, part_number, description, quantity, unit_cost } = parsed.data
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, wo_id, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await ctx.admin.from('wo_parts').insert({ wo_id, line_id, part_number: part_number?.trim() || null, description: description.trim(), quantity: quantity ?? 1, unit_cost: unit_cost ?? 0, status: 'needed' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await ctx.admin.from('wo_activity_log').insert({ wo_id, user_id: ctx.actor.id, action: `Added part: ${description.trim()}` })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_PARTS_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const raw = await req.json().catch(() => null)
  if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const parsed = WoPartsPatchSchema.safeParse(raw)
  if (!parsed.success) return badInput(parsed.error)
  const { id, status, quantity, unit_cost, wo_id, expected_updated_at } = parsed.data
  const expectedUpdatedAt = typeof expected_updated_at === 'string' ? expected_updated_at : null
  if (!expectedUpdatedAt) return NextResponse.json({ error: 'expected_updated_at is required' }, { status: 400 })
  const targetWoId = wo_id || (await ctx.admin.from('wo_parts').select('wo_id').eq('id', id).single()).data?.wo_id
  if (!targetWoId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, targetWoId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const update: Record<string, any> = {}
  if (status !== undefined) update.status = status
  if (quantity !== undefined) update.quantity = quantity
  if (unit_cost !== undefined) update.unit_cost = unit_cost
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  const { data, error } = await ctx.admin.from('wo_parts').update(update).eq('id', id).eq('updated_at', expectedUpdatedAt).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Conflict', message: 'This record was updated by someone else. Refresh and try again.' }, { status: 409 })
  if (status) await ctx.admin.from('wo_activity_log').insert({ wo_id: targetWoId, user_id: ctx.actor.id, action: `Part status changed to ${status}` })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_PARTS_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!uuid.safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const { data: part } = await ctx.admin.from('wo_parts').select('id, wo_id').eq('id', id).single()
  if (!part) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, (part as any).wo_id, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await ctx.admin.from('wo_parts').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
