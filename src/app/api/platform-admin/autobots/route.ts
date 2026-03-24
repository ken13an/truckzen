import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/platform-admin/autobots — list all autobots + scenarios
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', userId).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const [{ data: bots }, { data: scenarios }] = await Promise.all([
    s.from('autobots').select('*').order('name'),
    s.from('autobot_scenarios').select('*').order('is_preset', { ascending: false }).order('created_at'),
  ])

  return NextResponse.json({ bots: bots || [], scenarios: scenarios || [] })
}

// POST /api/platform-admin/autobots — save a custom scenario
export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { user_id, name, description, steps } = body

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!name || !steps) return NextResponse.json({ error: 'name and steps required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', user_id).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { data, error } = await s.from('autobot_scenarios').insert({
    name,
    description: description || null,
    steps,
    is_preset: false,
    created_by: user_id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
