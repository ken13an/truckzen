import { NextResponse } from 'next/server'
import { checkPortalLimits } from '@/lib/ratelimit/portal-guard'
import { createClient } from '@supabase/supabase-js'
import { assertPartsRequirementResolved } from '@/lib/parts-status'

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

  // Parts-readiness gate — whole-WO scope: even a single-job approve is
  // blocked while any other labor line on the WO has an unresolved
  // parts_requirement. Same rationale as /approve: a customer must not be
  // able to flip approval flags piecemeal while staff has incomplete parts
  // decisions. Decline path is in /decline-job and intentionally untouched.
  const partsGate = await assertPartsRequirementResolved(s, wo.id, 'customer_portal')
  if (!partsGate.ok) {
    console.warn('[portal-approve-job] parts gate blocked', { woId: wo.id, lineId: line_id, failures: partsGate.failures })
    return NextResponse.json({
      error: 'Resolve parts decisions before approving this estimate.',
      unresolved_lines: partsGate.failures,
    }, { status: 422 })
  }

  await s.from('so_lines').update({ customer_approved: true, approved_at: new Date().toISOString() }).eq('id', line_id).eq('so_id', wo.id)
  await s.from('wo_activity_log').insert({ wo_id: wo.id, action: `Customer approved additional job: ${line_id}` })

  return NextResponse.json({ ok: true })
}
