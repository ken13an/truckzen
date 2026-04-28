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
  const body = await req.json().catch(() => ({}))

  const { data: wo } = await s.from('service_orders').select('id, ownership_type, workorder_lane').eq('portal_token', token).single()
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Customer-type guard. Only owner_operator / outside_customer portals may
  // call approve/decline. fleet_asset and unknown ownership are status-only;
  // maintenance_external lane is conservative status-only. Defense-in-depth
  // — frontend already hides the buttons via portalMode.
  const isPortalActionAllowed =
    (wo.ownership_type === 'owner_operator' || wo.ownership_type === 'outside_customer') &&
    wo.workorder_lane !== 'maintenance_external'
  if (!isPortalActionAllowed) {
    return NextResponse.json({ error: 'Not authorized for this portal action' }, { status: 403 })
  }

  // Parts-readiness gate — block approve when any non-canceled labor line on
  // this WO has an unresolved parts_requirement. Portal uses a non-override
  // actor role ('customer_portal') so 'override'-labeled lines fail-safe to
  // blocked. Decline path lives in /decline and is intentionally untouched.
  const partsGate = await assertPartsRequirementResolved(s, wo.id, 'customer_portal')
  if (!partsGate.ok) {
    console.warn('[portal-approve] parts gate blocked', { woId: wo.id, failures: partsGate.failures })
    return NextResponse.json({
      error: 'Resolve parts decisions before approving this estimate.',
      unresolved_lines: partsGate.failures,
    }, { status: 422 })
  }

  const now = new Date().toISOString()
  await s.from('service_orders').update({
    approved_at: now,
    approved_by: body.name || 'Customer',
    estimate_status: 'approved',
    estimate_approved_date: now,
  }).eq('id', wo.id)

  // Approve all pending lines
  await s.from('so_lines').update({ customer_approved: true, approved_at: new Date().toISOString() }).eq('so_id', wo.id).is('customer_approved', null)

  await s.from('wo_activity_log').insert({ wo_id: wo.id, action: `Estimate approved by customer via portal` })

  return NextResponse.json({ ok: true })
}
