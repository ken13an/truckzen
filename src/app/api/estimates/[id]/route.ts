import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'
import { assertPartsRequirementResolved } from '@/lib/parts-status'
import { z } from 'zod'

// No canonical estimate-status enum exists in the repo; validate shape only.
const numCoerce = z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number())
const EstimatePatchSchema = z.object({
  // Optimistic-concurrency marker — see patch below. Optional for backward
  // compatibility with un-wired UI; when sent, a precondition match is
  // enforced and a 409 Conflict is returned on mismatch.
  expected_updated_at: z.string().datetime({ offset: true }).optional().nullable(),
  status: z.string().max(32).optional(),
  notes: z.string().max(5000).optional().nullable(),
  customer_name: z.string().max(200).optional().nullable(),
  customer_email: z.string().email().max(320).optional().nullable(),
  customer_phone: z.string().max(64).optional().nullable(),
  approval_method: z.string().max(64).optional().nullable(),
  approved_at: z.string().datetime().optional().nullable(),
  customer_notes: z.string().max(5000).optional().nullable(),
  decline_reason: z.string().max(1000).optional().nullable(),
  lines: z.array(z.object({
    repair_order_line_id: z.string().uuid().optional().nullable(),
    so_line_id: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional(),
    complaint: z.string().max(2000).optional().nullable(),
    labor_hours: numCoerce.optional(),
    labor_rate: numCoerce.optional(),
    labor_total: numCoerce.optional(),
    parts_total: numCoerce.optional(),
    line_total: numCoerce.optional(),
    is_approved: z.boolean().optional().nullable(),
    customer_response: z.string().max(500).optional().nullable(),
    line_type: z.string().max(32).optional(),
    total: numCoerce.optional(),
    quantity: numCoerce.optional(),
    unit_price: numCoerce.optional(),
    part_number: z.string().max(128).optional().nullable(),
  }).passthrough()).max(500).optional(),
}).strip()

function badInput(zErr: z.ZodError) {
  return NextResponse.json({ error: 'Invalid payload', issues: zErr.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, { status: 400 })
}

async function getEstimateForActor(admin: any, actor: any, id: string) {
  let q = admin.from('estimates').select('*').eq('id', id)
  if (!actor.is_platform_owner && actor.effective_shop_id) q = q.eq('shop_id', actor.effective_shop_id)
  const { data, error } = await q.single()
  return { data, error }
}

async function _GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: estimate, error } = await getEstimateForActor(ctx.admin, ctx.actor, id)
  if (error || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
  const { data: lines } = await ctx.admin.from('estimate_lines').select('*').eq('estimate_id', id).order('line_number')
  let serviceOrder = null
  const repairOrderId = (estimate as any).repair_order_id || (estimate as any).wo_id
  if (repairOrderId) {
    const { data: so } = await ctx.admin.from('service_orders').select('id, so_number, status, complaint, assets(unit_number, year, make, model, vin)').eq('id', repairOrderId).single()
    serviceOrder = so
  }
  const { data: shop } = await ctx.admin.from('shops').select('name, dba, phone, email, tax_rate').eq('id', (estimate as any).shop_id).single()
  return NextResponse.json({ ...estimate, lines: lines || [], service_order: serviceOrder, shop })
}

async function _PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireRouteContext([...INVOICE_ACTION_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: estimate } = await getEstimateForActor(ctx.admin, ctx.actor, id)
  if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
  const raw = await req.json().catch(() => null)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = EstimatePatchSchema.safeParse(raw)
  if (!parsed.success) return badInput(parsed.error)
  const body = parsed.data
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of ['status', 'notes', 'customer_name', 'customer_email', 'customer_phone', 'approval_method', 'approved_at', 'customer_notes', 'decline_reason'] as const) if (body?.[key] !== undefined) updates[key] = body[key]
  if (body?.status === 'sent') {
    updates.sent_at = new Date().toISOString()
    updates.valid_until = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  }
  if (body?.status === 'approved') updates.approved_by = ctx.actor.id

  // Parts-readiness gate — close the staff-side approve gap. Every other
  // approve route (customer portal × 3, supplement × 2, estimate-email
  // respond, send-estimate) calls assertPartsRequirementResolved before
  // flipping an estimate to 'approved'. The Approve In Person / Print &
  // Sign paths use this PATCH and were the only approve surface bypassing
  // the gate. Mirrors src/app/api/portal/[token]/estimate/approve/route.ts
  // and src/app/api/estimates/[id]/respond/route.ts. 422 with
  // unresolved_lines so the existing modal can surface them.
  if (body?.status === 'approved') {
    const repairOrderId = (estimate as any).repair_order_id || (estimate as any).wo_id
    if (repairOrderId) {
      const actorRole = ctx.actor.impersonate_role || ctx.actor.role
      const partsGate = await assertPartsRequirementResolved(ctx.admin, repairOrderId, actorRole)
      if (!partsGate.ok) {
        console.warn('[estimate-patch-approve] parts gate blocked', { estimateId: id, woId: repairOrderId, failures: partsGate.failures })
        return NextResponse.json({
          error: 'Resolve parts decisions before approving this estimate.',
          unresolved_lines: partsGate.failures,
        }, { status: 422 })
      }
    }
  }

  // Optimistic concurrency: when client provides last-seen updated_at,
  // require match. Missing value preserves legacy behavior.
  const expectedUpdatedAt = typeof body.expected_updated_at === 'string' ? body.expected_updated_at : null
  if (!expectedUpdatedAt) return NextResponse.json({ error: 'expected_updated_at is required' }, { status: 400 })
  let estQ = ctx.admin.from('estimates').update(updates).eq('id', id)
  if (expectedUpdatedAt) estQ = estQ.eq('updated_at', expectedUpdatedAt)
  const { data, error } = await estQ.select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json({ error: 'Conflict', message: 'This record was updated by someone else. Refresh and try again.' }, { status: 409 })
  }
  // Mirror the customer-portal approve path: when the estimate transitions to
  // approved (in-person / printed-signed), move the linked WO out of
  // waiting_approval so the automation panel stops reporting Blocked /
  // Awaiting approval. Only transitions from waiting_approval → in_progress;
  // no effect on other statuses. Intentionally does NOT touch updated_at so
  // the client's follow-up PATCH /api/work-orders/[id] (estimate_approved,
  // estimate_status, approval_method) can still match its expected_updated_at.
  if (body?.status === 'approved') {
    const repairOrderId = (estimate as any).repair_order_id || (estimate as any).wo_id
    if (repairOrderId) {
      const { data: wo } = await ctx.admin.from('service_orders').select('status').eq('id', repairOrderId).single()
      if (wo?.status === 'waiting_approval') {
        await ctx.admin.from('service_orders').update({ status: 'in_progress' }).eq('id', repairOrderId)
      }
    }
  }
  if (body?.lines && Array.isArray(body.lines)) {
    // Sum totals by reading the body's labor_total / parts_total / total
    // fields (which the UI sends). Discrimination uses the body's
    // line_type ONLY to bucket the sum — that field is NOT written to
    // estimate_lines (no such column in the live schema).
    const laborTotal = body.lines.reduce((s: number, l: any) => s + (parseFloat(l.labor_total ?? l.total) || 0) * ((l.line_type === 'labor') ? 1 : 0), 0)
    const partsTotal = body.lines.reduce((s: number, l: any) => s + (parseFloat(l.parts_total ?? l.total) || 0) * ((l.line_type === 'part') ? 1 : 0), 0)
    const subtotal = laborTotal + partsTotal
    // Tax mirrors calcInvoiceTotals (parts-only when tax_labor=false;
    // labor+parts when tax_labor=true).
    const { data: shop } = await ctx.admin.from('shops').select('tax_rate, tax_labor').eq('id', (estimate as any).shop_id).single()
    const taxRate = shop?.tax_rate || 0
    const taxLabor = shop?.tax_labor === true
    const taxableAmount = partsTotal + (taxLabor ? laborTotal : 0)
    const taxAmount = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0
    const total = subtotal + taxAmount

    // Delete-then-insert rebuild — scoped to this estimate_id only.
    const { error: delErr } = await ctx.admin.from('estimate_lines').delete().eq('estimate_id', id)
    if (delErr) {
      console.error('[estimates.patch] estimate_lines delete failed', { estimateId: id, error: delErr.message })
      return NextResponse.json({ error: `Failed to clear estimate lines: ${delErr.message}` }, { status: 500 })
    }

    await ctx.admin.from('estimates').update({ labor_total: laborTotal, parts_total: partsTotal, subtotal, tax_amount: taxAmount, total, grand_total: total }).eq('id', id)

    // Schema-safe row shape — only columns that exist in estimate_lines.
    // (no line_type / total / quantity / unit_price / so_line_id /
    // part_number columns). Part numbers are embedded in description so
    // they survive the snapshot.
    const lineRows = body.lines.map((l: any, i: number) => {
      const baseDesc = l.description || ''
      const desc = (l.line_type === 'part' && l.part_number)
        ? `${baseDesc} - Part # ${l.part_number}`
        : baseDesc
      return {
        estimate_id: id,
        repair_order_line_id: l.repair_order_line_id || null,
        description: desc,
        complaint: l.complaint || null,
        labor_hours: parseFloat(l.labor_hours) || 0,
        labor_rate: parseFloat(l.labor_rate) || 0,
        labor_total: parseFloat(l.labor_total) || 0,
        parts_total: parseFloat(l.parts_total) || 0,
        line_total: parseFloat(l.line_total ?? l.total) || 0,
        is_approved: l.is_approved ?? null,
        customer_response: l.customer_response || null,
        line_number: i + 1,
      }
    })
    if (lineRows.length > 0) {
      const { error: insErr } = await ctx.admin.from('estimate_lines').insert(lineRows)
      if (insErr) {
        console.error('[estimates.patch] estimate_lines insert failed', { estimateId: id, error: insErr.message })
        return NextResponse.json({ error: `Failed to write estimate lines: ${insErr.message}` }, { status: 500 })
      }
    }
  }
  return NextResponse.json(data)
}

export const GET = safeRoute(_GET)
export const PATCH = safeRoute(_PATCH)
