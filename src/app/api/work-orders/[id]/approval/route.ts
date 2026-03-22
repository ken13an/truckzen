/**
 * TruckZen — Original Design
 * Built independently by TruckZen development team
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type Params = { params: Promise<{ id: string }> }

// POST /api/work-orders/[id]/approval — handle approval + warranty actions
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const body = await req.json()
  const { action, user_id, ...data } = body

  if (!action || !user_id) return NextResponse.json({ error: 'action and user_id required' }, { status: 400 })

  // Approve a job line
  if (action === 'approve_job') {
    const { line_id, notes } = data
    if (!line_id) return NextResponse.json({ error: 'line_id required' }, { status: 400 })

    await s.from('so_lines').update({
      approval_status: 'approved',
      approved_by: user_id,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null,
    }).eq('id', line_id)

    // Log activity
    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: `Job approved${notes ? ': ' + notes : ''}` })

    return NextResponse.json({ ok: true })
  }

  // Decline a job line
  if (action === 'decline_job') {
    const { line_id, notes } = data
    if (!line_id) return NextResponse.json({ error: 'line_id required' }, { status: 400 })

    await s.from('so_lines').update({
      approval_status: 'declined',
      approved_by: user_id,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null,
    }).eq('id', line_id)

    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: `Job declined${notes ? ': ' + notes : ''}` })

    return NextResponse.json({ ok: true })
  }

  // Toggle pre-approval on a job
  if (action === 'toggle_approval') {
    const { line_id, needs_approval } = data
    if (!line_id) return NextResponse.json({ error: 'line_id required' }, { status: 400 })

    await s.from('so_lines').update({
      approval_required: needs_approval,
      approval_status: needs_approval ? 'needs_approval' : 'pre_approved',
    }).eq('id', line_id)

    return NextResponse.json({ ok: true })
  }

  // Warranty decision
  if (action === 'warranty_decision') {
    const { decision, notes } = data
    if (!decision) return NextResponse.json({ error: 'decision required' }, { status: 400 })

    const updates: any = {
      warranty_checked: true,
      warranty_status: decision,
      warranty_notes: notes || null,
      warranty_checked_by: user_id,
      warranty_checked_at: new Date().toISOString(),
    }

    // If send to dealer, lock the WO
    if (decision === 'send_to_dealer') {
      updates.status = 'waiting_approval'
    }

    await s.from('service_orders').update(updates).eq('id', id)
    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: `Warranty decision: ${decision}${notes ? ' — ' + notes : ''}` })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
