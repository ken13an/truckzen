import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { rateLimit } from '@/lib/ratelimit/core'

// Local inline predicate mirroring the canonical helper from source's
// parts-status.ts. Kept local here so this route does not require editing
// src/lib/parts-status.ts (out of scope for this patch).
function isNonBillablePartRequirementRow(line: { line_type?: string | null; parts_requirement?: string | null }): boolean {
  if (line?.line_type !== 'part') return false
  return line?.parts_requirement === 'customer_supplied' || line?.parts_requirement === 'not_needed'
}

function esc(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function money(n: any): string {
  const v = Number(n)
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
}

type P = { params: Promise<{ id: string }> }

/**
 * Send one specific supplement batch to the customer for approval.
 *
 * Batch-scoped by design — a WO can have multiple pending supplement batches
 * over time. This route sends ONE batch; prior approved/declined batches are
 * not touched and future batches remain independently sendable.
 *
 * Body: { supplement_batch_id: string }
 * Never trusts client totals / shop_id / user_id — everything re-derived
 * server-side from the DB via service role.
 *
 * NOTE: This destination does not yet expose the customer-facing
 * /api/portal/[token]/estimate/supplement/respond endpoint. To avoid
 * shipping dead email links, the customer-facing approve/decline buttons
 * are intentionally omitted from the email body; staff can approve or
 * decline the supplement in person via /api/estimates/[id]/supplement-respond.
 * When the customer-portal supplement-respond endpoint is later added, the
 * `customerActionsBlock` variable below can be restored to include approve
 * and decline links without any other change to this route.
 */
async function _POST(req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext([...INVOICE_ACTION_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!

  const sendLimit = await rateLimit('supplement-send-user', ctx.actor.id)
  if (!sendLimit.allowed) return NextResponse.json({ error: 'Too many estimate send requests' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const supplementBatchId = body && typeof body.supplement_batch_id === 'string' ? body.supplement_batch_id : null
  if (!supplementBatchId) return NextResponse.json({ error: 'Missing estimate group identifier' }, { status: 400 })

  // Estimate + WO resolution with shop scope.
  let estQ = ctx.admin.from('estimates').select('*').eq('id', id)
  if (!ctx.actor.is_platform_owner && ctx.actor.effective_shop_id) estQ = estQ.eq('shop_id', ctx.actor.effective_shop_id)
  const { data: estimate, error: estErr } = await estQ.single()
  if (estErr || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  const woId = (estimate as any).repair_order_id || (estimate as any).wo_id
  if (!woId) return NextResponse.json({ error: 'Estimate has no linked WO' }, { status: 400 })

  const { data: wo } = await ctx.admin.from('service_orders')
    .select('id, so_number, shop_id, portal_token, customer_id, assets(unit_number, year, make, model, vin, ownership_type), customers(company_name, contact_name, email, phone)')
    .eq('id', woId).single()
  if (!wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })
  if ((wo as any).shop_id !== (estimate as any).shop_id) return NextResponse.json({ error: 'WO/estimate shop mismatch' }, { status: 403 })

  // Pending lines in this batch.
  const { data: batchLines } = await ctx.admin.from('so_lines')
    .select('id, line_type, description, real_name, rough_name, part_number, quantity, unit_price, parts_sell_price, billed_hours, actual_hours, estimated_hours, parts_status, parts_requirement, parts_requirement_note, is_additional, customer_approved, supplement_batch_id')
    .eq('so_id', woId)
    .eq('is_additional', true)
    .eq('supplement_batch_id', supplementBatchId)
    .is('customer_approved', null)

  const { data: batchParts } = await ctx.admin.from('wo_parts')
    .select('id, description, part_number, quantity, unit_cost, status, is_additional, customer_approved, supplement_batch_id')
    .eq('wo_id', woId)
    .eq('is_additional', true)
    .eq('supplement_batch_id', supplementBatchId)
    .is('customer_approved', null)

  const pendingLines = (batchLines || []).filter((l: any) => l.parts_status !== 'canceled')
  const pendingParts = (batchParts || []).filter((p: any) => p.status !== 'canceled')
  if (pendingLines.length === 0 && pendingParts.length === 0) {
    return NextResponse.json({ error: 'No pending lines for this estimate group' }, { status: 400 })
  }

  // Labor rate resolution.
  const { data: shopRow } = await ctx.admin.from('shops')
    .select('name, dba, phone, email, address, city, state, zip, tax_rate, tax_labor, default_labor_rate, labor_rate')
    .eq('id', (estimate as any).shop_id).single()
  const ownership = (wo as any).assets?.ownership_type || (estimate as any).ownership_type || 'outside_customer'
  const { data: ownershipRate } = await ctx.admin.from('shop_labor_rates')
    .select('rate_per_hour').eq('shop_id', (estimate as any).shop_id).eq('ownership_type', ownership).maybeSingle()
  const laborRate = Number(ownershipRate?.rate_per_hour || shopRow?.labor_rate || shopRow?.default_labor_rate || 0)
  const taxRate = Number(shopRow?.tax_rate) || 0
  const taxLabor = shopRow?.tax_labor === true

  // Compute supplement totals from server rows only.
  const laborRows = pendingLines.filter((l: any) => l.line_type === 'labor')
  const partRows = pendingLines.filter((l: any) => l.line_type === 'part' && !isNonBillablePartRequirementRow(l))
  const laborTotal = laborRows.reduce((s: number, l: any) => {
    const hrs = Number(l.billed_hours || l.actual_hours || l.estimated_hours || 0)
    return s + hrs * laborRate
  }, 0)
  const partsTotalFromLines = partRows.reduce((s: number, l: any) => {
    const sell = Number(l.parts_sell_price || l.unit_price || 0)
    const qty = Number(l.quantity || 1)
    return s + sell * qty
  }, 0)
  const partsTotalFromWoParts = pendingParts.reduce((s: number, p: any) => s + Number(p.unit_cost || 0) * Number(p.quantity || 1), 0)
  const partsTotal = partsTotalFromLines + partsTotalFromWoParts
  const subtotal = laborTotal + partsTotal
  const taxableAmount = partsTotal + (taxLabor ? laborTotal : 0)
  const taxAmount = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0
  const grandTotal = subtotal + taxAmount

  // Resolve supplement batch display number (1-based, oldest pending first).
  // Derived from the DB, not from the client.
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

  // Customer-facing email body — supplement-only content. Approve/decline
  // CTAs are intentionally omitted: destination does not expose
  // /api/portal/[token]/estimate/supplement/respond, and we will not ship
  // dead links. Customer is directed to contact the shop to approve.
  const shopInfo = await getShopInfo((estimate as any).shop_id)
  const shopName = shopRow?.dba || shopRow?.name || shopInfo.name || 'TruckZen'
  const cust = (wo as any).customers as any
  const asset = (wo as any).assets as any
  const customerEmail = cust?.email || (estimate as any).customer_email
  const customerName = cust?.company_name || cust?.contact_name || (estimate as any).customer_name || 'Customer'
  const truckInfo = asset ? `Unit #${asset.unit_number} - ${asset.year || ''} ${asset.make || ''} ${asset.model || ''}`.trim() : ''
  const woNumber = (wo as any).so_number || ''
  const shopPhone = shopRow?.phone || ''
  const shopEmail = shopRow?.email || ''

  const linesHtml = [
    ...pendingLines.filter((l: any) => !isNonBillablePartRequirementRow(l)).map((l: any) => {
      const isLabor = l.line_type === 'labor'
      const hrs = Number(l.billed_hours || l.actual_hours || l.estimated_hours || 0)
      const labor = isLabor ? hrs * laborRate : 0
      const sell = Number(l.parts_sell_price || l.unit_price || 0)
      const qty = Number(l.quantity || 1)
      const parts = !isLabor ? sell * qty : 0
      const total = labor + parts
      const qtyHrs = isLabor ? (hrs > 0 ? `${hrs} hr` : '—') : (qty > 0 ? String(qty) : '—')
      const desc = l.real_name || l.rough_name || l.description || (isLabor ? 'Labor' : 'Part')
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px;vertical-align:top">${esc(desc)}${l.part_number ? `<div style="font-size:11px;color:#8a8a9a;margin-top:2px">Part # ${esc(l.part_number)}</div>` : ''}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:center;vertical-align:top">${qtyHrs}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right;vertical-align:top">${isLabor ? '$' + money(labor) : '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right;vertical-align:top">${!isLabor ? '$' + money(parts) : '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px;font-weight:700;text-align:right;vertical-align:top">$${money(total)}</td>
      </tr>`
    }),
    ...pendingParts.map((p: any) => {
      const qty = Number(p.quantity || 1)
      const cost = Number(p.unit_cost || 0)
      const total = cost * qty
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px;vertical-align:top">${esc(p.description || 'Part')}${p.part_number ? `<div style="font-size:11px;color:#8a8a9a;margin-top:2px">Part # ${esc(p.part_number)}</div>` : ''}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:center;vertical-align:top">${qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right;vertical-align:top">—</td>
        <td style="padding:10px 8px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right;vertical-align:top">$${money(total)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px;font-weight:700;text-align:right;vertical-align:top">$${money(total)}</td>
      </tr>`
    }),
  ].join('')

  // Contact-the-shop block in place of customer-portal approve/decline links
  // until the portal supplement-respond route is added.
  const contactBlock = `<div style="text-align:center;margin:24px 0 8px;padding:16px;background:#15152a;border-radius:10px">
    <div style="color:#ffffff;font-size:14px;font-weight:700;margin-bottom:6px">Please contact ${esc(shopName)} to approve Estimate ${estimateNumber}</div>
    ${shopPhone ? `<div style="color:#b0b0c0;font-size:13px">Phone: ${esc(shopPhone)}</div>` : ''}
    ${shopEmail ? `<div style="color:#b0b0c0;font-size:13px">Email: ${esc(shopEmail)}</div>` : ''}
    <div style="color:#8a8a9a;font-size:11px;margin-top:10px">This approval covers only Estimate ${estimateNumber}. Your Estimate 1 remains unchanged.</div>
  </div>`

  const emailHtml = `<div style="background:#0f0f1a;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#1a1a2e;border-radius:12px;overflow:hidden">
    <div style="padding:24px;background:#1d1d35;border-bottom:1px solid #2a2a3a">
      <h1 style="margin:0;color:#ffffff;font-size:18px">Additional Estimate — Estimate ${estimateNumber}</h1>
      <div style="color:#8a8a9a;font-size:12px;margin-top:4px">${esc(shopName)}${woNumber ? ` · WO ${esc(woNumber)}` : ''}${truckInfo ? ` · ${esc(truckInfo)}` : ''}</div>
    </div>
    <div style="padding:24px">
      <p style="color:#e0e0e0;font-size:14px;margin:0 0 8px">Hi ${esc(customerName)},</p>
      <p style="color:#b0b0c0;font-size:13px;margin:0 0 16px">During the repair we found additional work that needs your approval. Your <strong style="color:#e0e0e0">Estimate 1 remains approved</strong> — the items below are a separate <strong style="color:#e0e0e0">Estimate ${estimateNumber}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;table-layout:auto">
        <thead>
          <tr style="background:#15152a">
            <th style="padding:8px 12px;text-align:left;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Description</th>
            <th style="padding:8px 8px;text-align:center;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">Qty / Hrs</th>
            <th style="padding:8px 8px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Labor</th>
            <th style="padding:8px 8px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Parts</th>
            <th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Total</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
      </table>
      <div style="text-align:right;padding:12px 0;border-top:1px solid #2a2a3a">
        <div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Labor: $${money(laborTotal)}</div>
        <div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Parts: $${money(partsTotal)}</div>
        <div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Subtotal: $${money(subtotal)}</div>
        <div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Tax${taxRate ? ` (${esc(taxRate)}%)` : ''}: $${money(taxAmount)}</div>
        <div style="color:#ffffff;font-size:16px;font-weight:800">Estimate ${estimateNumber} Total: $${money(grandTotal)}</div>
      </div>
      ${contactBlock}
    </div>
  </div>
</div>`

  const sentVia: string[] = []
  if (customerEmail) {
    const ok = await sendEmail(customerEmail, `Estimate ${estimateNumber} Approval Needed · ${shopName}`, emailHtml)
    if (ok) sentVia.push('email')
  }

  if (sentVia.length === 0) {
    return NextResponse.json({ error: 'Estimate not sent — no channel available or email delivery failed' }, { status: 502 })
  }

  try {
    await ctx.admin.from('wo_activity_log').insert({
      wo_id: woId,
      user_id: ctx.actor.id,
      action: `Estimate ${estimateNumber} sent for approval: $${money(grandTotal)}`,
      details: {
        event: 'supplement_sent',
        estimate_id: id,
        supplement_batch_id: supplementBatchId,
        batch_number: batchNumber,
        line_count: pendingLines.length + pendingParts.length,
        subtotal,
        grand_total: grandTotal,
        sent_via: sentVia,
        actor_user_id: ctx.actor.id,
      },
    })
  } catch { /* activity log must not break send result */ }

  return NextResponse.json({
    ok: true,
    sent_via: sentVia,
    supplement_batch_id: supplementBatchId,
    batch_number: batchNumber,
    line_count: pendingLines.length + pendingParts.length,
    subtotal,
    grand_total: grandTotal,
  })
}

export const POST = safeRoute(_POST)
