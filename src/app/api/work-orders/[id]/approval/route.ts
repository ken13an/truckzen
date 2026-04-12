import { SERVICE_PARTS_ROLES } from '@/lib/roles'
/**
 * TruckZen — Original Design
 * Built independently by TruckZen development team
 */
import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'
import { safeRoute } from '@/lib/api-handler'

type Params = { params: Promise<{ id: string }> }

async function _POST(req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await requireRouteContext([...SERVICE_PARTS_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, id, 'id, shop_id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { action, ...data } = body
  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  if (action === 'approve_job' || action === 'decline_job' || action === 'toggle_approval') {
    const { line_id, notes, needs_approval } = data
    if (!line_id) return NextResponse.json({ error: 'line_id required' }, { status: 400 })

    const { data: line } = await ctx.admin.from('so_lines').select('id, so_id').eq('id', line_id).single()
    if (!line || line.so_id !== id) return NextResponse.json({ error: 'Job line not found' }, { status: 404 })

    if (action === 'toggle_approval') {
      await ctx.admin.from('so_lines').update({
        approval_required: !!needs_approval,
        approval_status: needs_approval ? 'needs_approval' : 'pre_approved',
      }).eq('id', line_id)
      return NextResponse.json({ ok: true })
    }

    const approved = action === 'approve_job'
    await ctx.admin.from('so_lines').update({
      approval_status: approved ? 'approved' : 'declined',
      approved_by: ctx.actor.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null,
    }).eq('id', line_id)

    await ctx.admin.from('wo_activity_log').insert({ wo_id: id, user_id: ctx.actor.id, action: `Job ${approved ? 'approved' : 'declined'}${notes ? ': ' + notes : ''}` })
    return NextResponse.json({ ok: true })
  }

  if (action === 'warranty_decision') {
    const { decision, notes } = data
    if (!decision) return NextResponse.json({ error: 'decision required' }, { status: 400 })

    const updates: any = {
      warranty_checked: true,
      warranty_status: decision,
      warranty_notes: notes || null,
      warranty_resolved_by: ctx.actor.id,
      warranty_resolved_at: new Date().toISOString(),
    }
    if (decision === 'send_to_dealer') {
      updates.status = 'waiting_approval'
      if (data.dealer_name) updates.warranty_dealer_name = data.dealer_name
      if (data.dealer_location) updates.warranty_dealer_location = data.dealer_location
    }

    await ctx.admin.from('service_orders').update(updates).eq('id', id)
    await ctx.admin.from('wo_activity_log').insert({ wo_id: id, user_id: ctx.actor.id, action: `Warranty decision: ${decision}${notes ? ' — ' + notes : ''}` })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export const POST = safeRoute(_POST)
