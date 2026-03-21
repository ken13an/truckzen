import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

export async function POST(req: Request, { params }: P) {
  const { token } = await params
  const s = db()
  const body = await req.json().catch(() => ({}))

  const { data: wo } = await s.from('service_orders').select('id, so_number').eq('portal_token', token).single()
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await s.from('service_orders').update({
    estimate_status: 'declined',
    estimate_declined_reason: body.reason || null,
  }).eq('id', wo.id)

  await s.from('wo_activity_log').insert({
    wo_id: wo.id,
    action: `Customer declined estimate${body.reason ? ': ' + body.reason : ''} via portal`,
  })

  return NextResponse.json({ ok: true })
}
