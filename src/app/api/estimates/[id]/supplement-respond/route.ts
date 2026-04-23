import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'

type P = { params: Promise<{ id: string }> }

/**
 * Staff-side supplement response. Scoped to a single supplement_batch_id using
 * row-level state (so_lines.customer_approved + wo_parts.customer_approved).
 *
 * Body: {
 *   action: 'approve' | 'decline',
 *   supplement_batch_id: string,
 *   approval_method?: string,
 *   approval_notes?: string,
 *   decline_reason?: string,
 * }
 *
 * Strictly batch-scoped: every row-level UPDATE carries
 *   .eq('is_additional', true)
 *   .eq('supplement_batch_id', supplement_batch_id)
 *   .is('customer_approved', null)
 * so original estimate lines and other pending/approved/declined batches
 * are not affected. approval_method / notes / decline_reason are stored in
 * wo_activity_log.details to keep audit truth without a schema change.
 */
async function _POST(req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext([...INVOICE_ACTION_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const action = body.action
  const supplementBatchId = typeof body.supplement_batch_id === 'string' ? body.supplement_batch_id : null
  const approvalMethod = typeof body.approval_method === 'string' ? body.approval_method : 'in_person'
  const approvalNotes = typeof body.approval_notes === 'string' ? body.approval_notes : null
  const declineReason = typeof body.decline_reason === 'string' ? body.decline_reason : null

  if (action !== 'approve' && action !== 'decline') {
    return NextResponse.json({ error: 'action must be approve or decline' }, { status: 400 })
  }
  if (!supplementBatchId) return NextResponse.json({ error: 'Missing estimate group identifier' }, { status: 400 })

  // Estimate + WO + shop-scope resolution.
  let estQ = ctx.admin.from('estimates').select('id, shop_id, repair_order_id, wo_id, estimate_number').eq('id', id)
  if (!ctx.actor.is_platform_owner && ctx.actor.effective_shop_id) estQ = estQ.eq('shop_id', ctx.actor.effective_shop_id)
  const { data: estimate, error: estErr } = await estQ.single()
  if (estErr || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  const woId = (estimate as any).repair_order_id || (estimate as any).wo_id
  if (!woId) return NextResponse.json({ error: 'Estimate has no linked WO' }, { status: 400 })

  const now = new Date().toISOString()
  const nextValue = action === 'approve' ? true : false

  // STRICT batch scope: update only pending rows in this batch.
  const { data: upLines } = await ctx.admin.from('so_lines')
    .update({ customer_approved: nextValue, approved_at: now })
    .eq('so_id', woId).eq('is_additional', true).eq('supplement_batch_id', supplementBatchId).is('customer_approved', null)
    .select('id')
  const { data: upParts } = await ctx.admin.from('wo_parts')
    .update({ customer_approved: nextValue, approved_at: now })
    .eq('wo_id', woId).eq('is_additional', true).eq('supplement_batch_id', supplementBatchId).is('customer_approved', null)
    .select('id')

  const lineIds = (upLines || []).map((r: any) => r.id)
  const partIds = (upParts || []).map((r: any) => r.id)

  if (lineIds.length === 0 && partIds.length === 0) {
    return NextResponse.json({ error: 'No pending items for this estimate group' }, { status: 409 })
  }

  // User-facing Estimate N label derived from DB order (not trusted from client).
  // Original pre-approval scope = Estimate 1; first supplement = Estimate 2, etc.
  const { data: allBatchesRaw } = await ctx.admin.from('so_lines')
    .select('supplement_batch_id, created_at')
    .eq('so_id', woId).eq('is_additional', true).not('supplement_batch_id', 'is', null)
  const batchFirstSeen = new Map<string, string>()
  for (const r of (allBatchesRaw || [])) {
    const bid = (r as any).supplement_batch_id
    const ts = (r as any).created_at
    if (!batchFirstSeen.has(bid) || ts < (batchFirstSeen.get(bid) as string)) batchFirstSeen.set(bid, ts)
  }
  const batchOrder = [...batchFirstSeen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const batchNumber = batchOrder.findIndex(([bid]) => bid === supplementBatchId) + 1 || 1
  const estimateNumber = batchNumber + 1

  try {
    await ctx.admin.from('wo_activity_log').insert({
      wo_id: woId,
      user_id: ctx.actor.id,
      action: action === 'approve'
        ? `Estimate ${estimateNumber} approved (${approvalMethod})${approvalNotes ? ` — Notes: ${String(approvalNotes).slice(0, 200)}` : ''}`
        : `Estimate ${estimateNumber} declined (${approvalMethod})${declineReason ? ` — ${String(declineReason).slice(0, 200)}` : ''}`,
      details: {
        event: action === 'approve' ? 'supplement_approved' : 'supplement_declined',
        wo_id: woId,
        estimate_id: id,
        supplement_batch_id: supplementBatchId,
        [action === 'approve' ? 'approved_line_ids' : 'declined_line_ids']: lineIds,
        [action === 'approve' ? 'approved_part_ids' : 'declined_part_ids']: partIds,
        approval_method: approvalMethod,
        approval_notes: action === 'approve' ? (approvalNotes || null) : null,
        decline_reason: action === 'decline' ? (declineReason || null) : null,
        actor_user_id: ctx.actor.id,
      },
    })
  } catch { /* activity log failure must not break the response */ }

  return NextResponse.json({
    ok: true,
    action,
    supplement_batch_id: supplementBatchId,
    updated_lines: lineIds.length,
    updated_parts: partIds.length,
  })
}

export const POST = safeRoute(_POST)
