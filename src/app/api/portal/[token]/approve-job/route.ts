import { NextResponse } from 'next/server'
import { checkPortalLimits } from '@/lib/ratelimit/portal-guard'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

export async function POST(req: Request, { params }: P) {
  const { token } = await params
  const _rl = await checkPortalLimits(req, token); if (_rl !== true) return _rl
  const s = db()
  const { line_id } = await req.json()
  if (!line_id) return NextResponse.json({ error: 'line_id required' }, { status: 400 })

  const { data: wo } = await s.from('service_orders').select('id').eq('portal_token', token).single()
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await s.from('so_lines').update({ customer_approved: true, approved_at: new Date().toISOString() }).eq('id', line_id).eq('so_id', wo.id)
  await s.from('wo_activity_log').insert({ wo_id: wo.id, action: `Customer approved additional job: ${line_id}` })

  return NextResponse.json({ ok: true })
}
