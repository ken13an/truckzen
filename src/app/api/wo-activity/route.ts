import { WO_FULL_ACCESS_ROLES } from '@/lib/roles'
import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const woId = new URL(req.url).searchParams.get('wo_id')
  if (!woId) return NextResponse.json({ error: 'wo_id required' }, { status: 400 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, woId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await ctx.admin.from('wo_activity_log').select('*, users(full_name)').eq('wo_id', woId).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = await requireRouteContext([...WO_FULL_ACCESS_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const body = await req.json().catch(() => null)
  const woId = body?.wo_id
  const action = typeof body?.action === 'string' ? body.action.trim() : ''
  if (!woId || !action) return NextResponse.json({ error: 'wo_id and action required' }, { status: 400 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, woId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await ctx.admin.from('wo_activity_log').insert({ wo_id: woId, user_id: ctx.actor.id, action }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
