import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const body = await req.json()

  const updateable = ['role', 'team', 'language', 'telegram_id', 'active', 'full_name', 'phone']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  const { data, error } = await s.from('users').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  // Soft delete: set deleted_at + deactivate. Actual removal after 30 days.
  await s.from('users').update({ active: false, deleted_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ success: true })
}
