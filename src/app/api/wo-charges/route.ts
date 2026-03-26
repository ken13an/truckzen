import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const woId = new URL(req.url).searchParams.get('wo_id')
  if (!woId) return NextResponse.json({ error: 'wo_id required' }, { status: 400 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, woId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await ctx.admin.from('wo_charges').select('*').eq('wo_id', woId).order('created_at').limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const body = await req.json().catch(() => null)
  const woId = body?.wo_id
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  if (!woId || !description || body?.amount == null) return NextResponse.json({ error: 'wo_id, description, and amount required' }, { status: 400 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, woId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await ctx.admin.from('wo_charges').insert({ wo_id: woId, description, amount: parseFloat(body.amount), taxable: !!body?.taxable }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: charge } = await ctx.admin.from('wo_charges').select('id, wo_id').eq('id', id).single()
  if (!charge) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, (charge as any).wo_id, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await ctx.admin.from('wo_charges').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
