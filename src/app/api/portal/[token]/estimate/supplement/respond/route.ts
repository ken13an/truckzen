import { NextResponse } from 'next/server'
import { checkPortalLimits } from '@/lib/ratelimit/portal-guard'
import { createClient } from '@supabase/supabase-js'
import { assertPartsRequirementResolved } from '@/lib/parts-status'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

/**
 * Portal customer response for ONE supplement batch. Mirrors the shape of
 * /api/estimates/[id]/respond (action: approve | decline, optional reason)
 * but is scoped to the row-level Phase 4 supplement model —
 * so_lines.customer_approved + wo_parts.customer_approved on a single
 * supplement_batch_id.
 *
 * Token validation: service_orders.portal_token (same pattern as the
 * existing /api/portal/[token]/estimate/new-items/approve route).
 *
 * Only rows matching (so_id OR wo_id) + is_additional=true +
 * supplement_batch_id=<requested> + customer_approved IS NULL are touched.
 * Canceled rows are excluded. Other batches and the original estimate are
 * never read or written.
 *
 * Accepts GET (one-click from email link; action comes via ?action=...)
 * and POST (form/fetch; action comes via JSON body).
 */
async function handle(req: Request, { params }: P) {
  const { token } = await params
  const _rl = await checkPortalLimits(req, token); if (_rl !== true) return _rl
  const s = db()

  const url = new URL(req.url)
  let action = url.searchParams.get('action')
  let batchId = url.searchParams.get('batch_id') || url.searchParams.get('supplement_batch_id')
  let reason = url.searchParams.get('reason')

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({})) as any
    if (!action && typeof body?.action === 'string') action = body.action
    if (!batchId) {
      if (typeof body?.supplement_batch_id === 'string') batchId = body.supplement_batch_id
      else if (typeof body?.batch_id === 'string') batchId = body.batch_id
    }
    if (!reason && typeof body?.reason === 'string') reason = body.reason
  }

  if (!action || (action !== 'approve' && action !== 'decline')) {
    return htmlOrJson(req, 400, 'Invalid action — must be approve or decline', 'invalid_action')
  }
  if (!batchId) return htmlOrJson(req, 400, 'Missing estimate identifier', 'missing_batch_id')

  const { data: wo } = await s.from('service_orders').select('id, so_number').eq('portal_token', token).single()
  if (!wo) return htmlOrJson(req, 404, 'Not found or link expired', 'not_found')

  // Parts-readiness gate — only on approve. Decline path is unchanged so
  // customers can always reject. Portal uses a non-override actor role.
  if (action === 'approve') {
    const partsGate = await assertPartsRequirementResolved(s, wo.id, 'customer_portal')
    if (!partsGate.ok) {
      console.warn('[portal-supplement-respond] parts gate blocked', { woId: wo.id, supplementBatchId: batchId, failures: partsGate.failures })
      return htmlOrJson(req, 422, 'Resolve parts decisions before approving this estimate.', 'parts_unresolved')
    }
  }

  const now = new Date().toISOString()
  const nextValue = action === 'approve' ? true : false

  // Batch-scoped updates. Strict filter: is_additional=true +
  // supplement_batch_id=<requested> + customer_approved IS NULL. No row
  // outside this batch can be affected.
  const { data: upLines } = await s.from('so_lines')
    .update({ customer_approved: nextValue, approved_at: now })
    .eq('so_id', wo.id).eq('is_additional', true).eq('supplement_batch_id', batchId).is('customer_approved', null)
    .select('id')
  const { data: upParts } = await s.from('wo_parts')
    .update({ customer_approved: nextValue, approved_at: now })
    .eq('wo_id', wo.id).eq('is_additional', true).eq('supplement_batch_id', batchId).is('customer_approved', null)
    .select('id')

  const lineIds = (upLines || []).map((r: any) => r.id)
  const partIds = (upParts || []).map((r: any) => r.id)

  if (lineIds.length === 0 && partIds.length === 0) {
    const msg = action === 'approve' ? 'No pending items to approve for this estimate' : 'No pending items to decline for this estimate'
    return htmlOrJson(req, 409, msg, 'no_pending_items')
  }

  // Resolve user-facing Estimate N label from DB order so activity log matches
  // the customer-facing email numbering. Original pre-approval scope = Estimate 1.
  const { data: allBatchesRaw } = await s.from('so_lines')
    .select('supplement_batch_id, created_at')
    .eq('so_id', wo.id).eq('is_additional', true).not('supplement_batch_id', 'is', null)
  const batchFirstSeen = new Map<string, string>()
  for (const r of (allBatchesRaw || [])) {
    const bid = (r as any).supplement_batch_id
    const ts = (r as any).created_at
    if (!batchFirstSeen.has(bid) || ts < (batchFirstSeen.get(bid) as string)) batchFirstSeen.set(bid, ts)
  }
  const batchOrder = [...batchFirstSeen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const batchNumber = batchOrder.findIndex(([bid]) => bid === batchId) + 1 || 1
  const estimateNumber = batchNumber + 1

  try {
    await s.from('wo_activity_log').insert({
      wo_id: wo.id,
      action: action === 'approve'
        ? `Customer approved Estimate ${estimateNumber} via portal`
        : `Customer declined Estimate ${estimateNumber} via portal${reason ? ` — ${String(reason).slice(0, 120)}` : ''}`,
      details: {
        event: action === 'approve' ? 'supplement_approved' : 'supplement_declined',
        wo_id: wo.id,
        supplement_batch_id: batchId,
        [action === 'approve' ? 'approved_line_ids' : 'declined_line_ids']: lineIds,
        [action === 'approve' ? 'approved_part_ids' : 'declined_part_ids']: partIds,
        approval_method: 'portal',
        reason: action === 'decline' ? (reason || null) : null,
      },
    })
  } catch { /* logging failure must not break the response */ }

  const successMsg = action === 'approve'
    ? `Estimate ${estimateNumber} approved — thank you.`
    : `Estimate ${estimateNumber} declined — thank you for letting us know.`
  return htmlOrJson(req, 200, successMsg, action === 'approve' ? 'approved' : 'declined', {
    action,
    supplement_batch_id: batchId,
    updated_lines: lineIds.length,
    updated_parts: partIds.length,
  })
}

function htmlOrJson(req: Request, status: number, message: string, state: string, extras: Record<string, any> = {}) {
  if (req.method === 'GET') {
    const color = state === 'approved' ? '#16A34A' : state === 'declined' ? '#DC2626' : '#DC2626'
    const symbol = state === 'approved' ? '&#10004;' : state === 'declined' ? '&#10060;' : '&#9888;'
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${message}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0f0f1a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
  <div style="max-width:420px;background:#1a1a2e;border:1px solid #2a2a3a;border-radius:12px;padding:32px;text-align:center">
    <div style="font-size:40px;margin-bottom:12px">${symbol}</div>
    <div style="font-size:18px;font-weight:700;color:${color};margin-bottom:8px">${message}</div>
    <div style="font-size:12px;color:#8a8a9a">You can close this page.</div>
  </div>
</body></html>`
    return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  return NextResponse.json({ ok: status === 200, state, message, ...extras }, { status })
}

export async function GET(req: Request, ctx: P) { return handle(req, ctx) }
export async function POST(req: Request, ctx: P) { return handle(req, ctx) }
