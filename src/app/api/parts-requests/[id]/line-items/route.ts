import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const { line_items, status } = await req.json()

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (line_items !== undefined) update.line_items = line_items
  if (status) update.status = status

  const { data, error } = await s.from('parts_requests').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
