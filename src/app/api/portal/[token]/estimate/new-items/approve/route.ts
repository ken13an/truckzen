import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

export async function POST(req: Request, { params }: P) {
  const { token } = await params
  const s = db()
  const { line_ids } = await req.json().catch(() => ({ line_ids: [] }))

  const { data: wo } = await s.from('service_orders').select('id').eq('portal_token', token).single()
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  if (Array.isArray(line_ids) && line_ids.length > 0) {
    for (const lid of line_ids) {
      await s.from('so_lines').update({ customer_approved: true, approved_at: now }).eq('id', lid).eq('so_id', wo.id)
    }
  } else {
    // Approve all unapproved additional lines
    await s.from('so_lines').update({ customer_approved: true, approved_at: now })
      .eq('so_id', wo.id).eq('is_additional', true).is('customer_approved', null)
  }

  await s.from('wo_activity_log').insert({ wo_id: wo.id, action: 'Customer approved additional repairs via portal' })

  return NextResponse.json({ ok: true })
}
