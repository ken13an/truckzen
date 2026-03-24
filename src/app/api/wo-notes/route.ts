import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const woId = searchParams.get('wo_id')
  if (!woId) return NextResponse.json({ error: 'wo_id required' }, { status: 400 })

  const { data, error } = await s.from('wo_notes').select('*').eq('wo_id', woId).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { wo_id, user_id, note_text, visible_to_customer } = body

  if (!wo_id || !note_text)
    return NextResponse.json({ error: 'wo_id and note_text required' }, { status: 400 })

  const { data, error } = await s.from('wo_notes').insert({
    wo_id,
    user_id: user_id || null,
    note_text: note_text.trim(),
    visible_to_customer: visible_to_customer ?? false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log to activity
  await s.from('wo_activity_log').insert({
    wo_id,
    user_id: user_id || null,
    action: 'Added a note',
  })

  return NextResponse.json(data, { status: 201 })
}
