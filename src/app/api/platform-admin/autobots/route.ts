import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'

export async function GET() {
  const { error } = await requirePlatformOwner()
  if (error) return error

  const s = createAdminSupabaseClient()
  const [{ data: bots }, { data: scenarios }] = await Promise.all([
    s.from('autobots').select('*').order('name'),
    s.from('autobot_scenarios').select('*').order('is_preset', { ascending: false }).order('created_at'),
  ])
  return NextResponse.json({ bots: bots || [], scenarios: scenarios || [] })
}

export async function POST(req: Request) {
  const { actor, error } = await requirePlatformOwner()
  if (error || !actor) return error

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const steps = body?.steps
  if (!name || !steps) return NextResponse.json({ error: 'name and steps required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { data, error: dbError } = await s.from('autobot_scenarios').insert({ name, description: body?.description || null, steps, is_preset: false, created_by: actor.id }).select().single()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
