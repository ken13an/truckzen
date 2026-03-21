import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET() {
  const s = db()
  const { data, error } = await s.from('build_progress').select('*').order('phase').order('done', { ascending: false }).order('label')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function PATCH(req: Request) {
  const s = db()
  const { id, done, note } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (done !== undefined) update.done = done
  if (note !== undefined) update.note = note
  const { error } = await s.from('build_progress').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
