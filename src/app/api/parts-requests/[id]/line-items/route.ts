import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const { line_items, status, user_id } = await req.json()

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (line_items !== undefined) update.line_items = line_items
  if (status) update.status = status

  const { data, error } = await s.from('parts_requests').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log to wo_activity_log
  if ((data as any).so_id && user_id) {
    const count = Array.isArray(line_items) ? line_items.length : 0
    await s.from('wo_activity_log').insert({ wo_id: (data as any).so_id, user_id, action: `Parts line items updated (${count} items)` }).then(() => {})
  }

  return NextResponse.json(data)
}
