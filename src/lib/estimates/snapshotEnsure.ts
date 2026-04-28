import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
import { isLineCanceled } from '@/lib/work-orders/jobLineValidation'

// CANONICAL ESTIMATE SNAPSHOT ENSURE / VALIDATE
//
// This is the ONE place where live so_lines / wo_parts data is allowed to
// flow into the customer-facing snapshot truth. Once these helpers run, the
// PDF generator and the send-route email body MUST read estimate_lines /
// estimates only — never live so_lines.
//
// The snapshot row shape and totals formula here are a literal copy of
// /api/estimates POST create_from_wo (route.ts:94-119). Do NOT invent new
// math here. If create_from_wo changes, mirror the change here.

export interface EnsureResult {
  ok: boolean
  reason?: string
  created: number
  existed: number
}

export interface ValidateResult {
  ok: boolean
  reason?: string
  laborCount: number
  partCount: number
  grandTotal: number
}

export interface BuiltSnapshot {
  estLines: any[]
  laborTotal: number
  partsTotal: number
  subtotal: number
  taxAmount: number
  grandTotal: number
}

export interface BuildSnapshotInput {
  estimateId: string
  shopId: string
  woId: string
  ownershipType: string | null | undefined
}

/**
 * Build estimate_lines rows + totals from current live so_lines / wo_parts.
 * Pure assembly — performs reads but no writes. Used by both the idempotent
 * ensure path (when no rows exist yet) and the explicit refresh path
 * (DELETE-then-INSERT). Mirrors create_from_wo formula in
 * /api/estimates/route.ts. Canceled labor lines and canceled parts are
 * excluded — they must not appear on customer-facing estimate truth.
 */
export async function buildSnapshotLinesAndTotals(admin: any, input: BuildSnapshotInput): Promise<BuiltSnapshot> {
  const { estimateId, shopId, woId, ownershipType } = input
  const effectiveOwnership = ownershipType || 'outside_customer'

  const { data: shop } = await admin
    .from('shops')
    .select('default_labor_rate, labor_rate, tax_rate, default_tax_rate, tax_labor')
    .eq('id', shopId)
    .single()

  const { data: ownershipRate } = await admin
    .from('shop_labor_rates')
    .select('rate_per_hour')
    .eq('shop_id', shopId)
    .eq('ownership_type', effectiveOwnership)
    .maybeSingle()

  const laborRate = Number(ownershipRate?.rate_per_hour)
    || Number(shop?.labor_rate)
    || Number(shop?.default_labor_rate)
    || DEFAULT_LABOR_RATE_FALLBACK
  const taxRate = Number(shop?.tax_rate) || Number(shop?.default_tax_rate) || 0
  const taxLabor = shop?.tax_labor === true

  const { data: lines } = await admin.from('so_lines').select('*').eq('so_id', woId)
  const { data: woParts } = await admin.from('wo_parts').select('*').eq('wo_id', woId)

  const estLines: any[] = []
  let lineNumber = 1
  for (const line of lines || []) {
    if (isLineCanceled(line as any)) continue
    if ((line as any).line_type === 'labor') {
      const hrs = (line as any).estimated_hours || (line as any).billed_hours || (line as any).actual_hours || 1
      const amt = hrs * laborRate
      estLines.push({
        estimate_id: estimateId,
        description: (line as any).description || '',
        labor_hours: hrs,
        labor_rate: laborRate,
        labor_total: amt,
        parts_total: 0,
        line_total: amt,
        line_number: lineNumber++,
      })
    } else if ((line as any).line_type === 'part' && ((line as any).real_name || (line as any).rough_name || (line as any).description)) {
      const price = (line as any).parts_sell_price || (line as any).unit_price || 0
      const qty = (line as any).quantity || 1
      const amt = qty * price
      const baseDesc = (line as any).real_name || (line as any).rough_name || (line as any).description
      const desc = (line as any).part_number ? `${baseDesc} - Part # ${(line as any).part_number}` : baseDesc
      estLines.push({
        estimate_id: estimateId,
        description: desc,
        labor_hours: 0,
        labor_rate: 0,
        labor_total: 0,
        parts_total: amt,
        line_total: amt,
        line_number: lineNumber++,
      })
    }
  }
  for (const part of woParts || []) {
    const qty = (part as any).quantity || 1
    const price = (part as any).unit_cost || 0
    const amt = qty * price
    const baseDesc = (part as any).description || ''
    const desc = (part as any).part_number ? `${baseDesc} - Part # ${(part as any).part_number}` : baseDesc
    estLines.push({
      estimate_id: estimateId,
      description: desc,
      labor_hours: 0,
      labor_rate: 0,
      labor_total: 0,
      parts_total: amt,
      line_total: amt,
      line_number: lineNumber++,
    })
  }

  const laborTotal = estLines.reduce((sum, l) => sum + (Number(l.labor_total) || 0), 0)
  const partsTotal = estLines.reduce((sum, l) => sum + (Number(l.parts_total) || 0), 0)
  const subtotal = laborTotal + partsTotal
  const taxableAmount = partsTotal + (taxLabor ? laborTotal : 0)
  const taxAmount = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0
  const grandTotal = subtotal + taxAmount

  return { estLines, laborTotal, partsTotal, subtotal, taxAmount, grandTotal }
}

/**
 * Idempotently ensure estimate_lines snapshot rows exist for this estimate.
 * - If rows already exist for this estimate_id, returns ok with existed > 0
 *   and does NOT touch any row (no overwrite).
 * - Otherwise builds rows from live so_lines + wo_parts using the same
 *   formula as /api/estimates POST create_from_wo.
 * - On insert success, also writes labor_total / parts_total / subtotal /
 *   tax_amount / grand_total / total on the estimate row using the same
 *   create_from_wo formula.
 * - Returns ok=false with a reason on any failure; the caller MUST NOT
 *   proceed to send when ok=false.
 *
 * Idempotency / dedupe: the existence check on estimate_id is the dedupe
 * key. Concurrent calls can race the existence check but the inserted rows
 * carry no UNIQUE constraint — see audit for the documented P1 follow-up
 * to add (estimate_id, line_number) uniqueness at the DB level.
 */
export async function ensureEstimateSnapshot(admin: any, estimateId: string): Promise<EnsureResult> {
  const { data: est } = await admin
    .from('estimates')
    .select('id, shop_id, wo_id, repair_order_id, status')
    .eq('id', estimateId)
    .single()
  if (!est) return { ok: false, reason: 'estimate_not_found', created: 0, existed: 0 }

  const { data: existing } = await admin
    .from('estimate_lines')
    .select('id', { count: 'exact', head: false })
    .eq('estimate_id', estimateId)
  const existedCount = existing?.length || 0
  if (existedCount > 0) {
    return { ok: true, created: 0, existed: existedCount }
  }

  const woId = (est as any).repair_order_id || (est as any).wo_id
  if (!woId) return { ok: false, reason: 'estimate_has_no_wo', created: 0, existed: 0 }

  // WO ownership_type — needed for ownership-typed labor rate lookup. Mirrors
  // page.tsx:826 EstimateTab logic so the snapshot's labor rate matches what
  // the writer sees on the WO Estimate tab before sending.
  const { data: woRow } = await admin
    .from('service_orders')
    .select('ownership_type, assets(ownership_type)')
    .eq('id', woId)
    .single()
  const ownershipType = (woRow as any)?.ownership_type
    || (woRow as any)?.assets?.ownership_type
    || 'outside_customer'

  const built = await buildSnapshotLinesAndTotals(admin, {
    estimateId,
    shopId: (est as any).shop_id,
    woId,
    ownershipType,
  })

  if (built.estLines.length === 0) {
    return { ok: false, reason: 'no_lines_to_snapshot', created: 0, existed: 0 }
  }

  // Re-check existence right before insert to narrow the concurrency window.
  const { data: recheck } = await admin
    .from('estimate_lines')
    .select('id')
    .eq('estimate_id', estimateId)
  if ((recheck?.length || 0) > 0) {
    return { ok: true, created: 0, existed: recheck!.length }
  }

  const { error: insertErr } = await admin.from('estimate_lines').insert(built.estLines)
  if (insertErr) {
    console.error('[estimate-snapshot] insert failed', { estimateId, error: insertErr.message })
    return { ok: false, reason: `insert_failed:${insertErr.message}`, created: 0, existed: 0 }
  }

  await admin
    .from('estimates')
    .update({
      labor_total: built.laborTotal,
      parts_total: built.partsTotal,
      subtotal: built.subtotal,
      tax_amount: built.taxAmount,
      grand_total: built.grandTotal,
      total: built.grandTotal,
    })
    .eq('id', estimateId)

  return { ok: true, created: built.estLines.length, existed: 0 }
}

/**
 * Read-only validation that the estimate has a snapshot the customer-facing
 * PDF can render. Does NOT modify any data.
 *
 * Structural completeness only:
 *   - estimate row exists
 *   - at least one estimate_lines row exists
 *   - every row has a non-empty description
 *
 * Totals are NOT required to be non-zero. A $0 part row (placeholder, not
 * yet priced, customer-supplied at no charge, etc.) is a normal estimate
 * state that canonical create_from_wo legitimately produces, and the prior
 * send route accepted them. The PDF generator renders whatever totals are
 * stored. Rejecting on $0 totals here causes false-negative send failures.
 */
export async function validateEstimateSnapshot(admin: any, estimateId: string): Promise<ValidateResult> {
  const { data: est } = await admin
    .from('estimates')
    .select('subtotal, tax_amount, total, grand_total')
    .eq('id', estimateId)
    .single()
  if (!est) return { ok: false, reason: 'estimate_not_found', laborCount: 0, partCount: 0, grandTotal: 0 }

  const { data: lines } = await admin
    .from('estimate_lines')
    .select('description, labor_hours, labor_total, parts_total, line_total')
    .eq('estimate_id', estimateId)
  const all = ((lines || []) as any[])
  if (all.length === 0) {
    return { ok: false, reason: 'no_snapshot_lines', laborCount: 0, partCount: 0, grandTotal: 0 }
  }

  for (const l of all) {
    if (!l.description || !String(l.description).trim()) {
      return { ok: false, reason: 'line_missing_description', laborCount: 0, partCount: 0, grandTotal: 0 }
    }
  }

  // Discriminate by amount fields (no line_type column exists in schema).
  // A row is treated as labor when it has any labor signal; otherwise part.
  const laborCount = all.filter((l) => (Number(l.labor_total) || 0) > 0 || (Number(l.labor_hours) || 0) > 0).length
  const partCount = all.length - laborCount
  const grand = Number((est as any).grand_total) || Number((est as any).total) || 0
  return { ok: true, laborCount, partCount, grandTotal: grand }
}
