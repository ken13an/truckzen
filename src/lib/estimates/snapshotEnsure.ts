import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'

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

  const { data: shop } = await admin
    .from('shops')
    .select('default_labor_rate, labor_rate, tax_rate, default_tax_rate')
    .eq('id', (est as any).shop_id)
    .single()
  const laborRate = shop?.default_labor_rate || shop?.labor_rate || DEFAULT_LABOR_RATE_FALLBACK
  const taxRate = shop?.tax_rate || shop?.default_tax_rate || 0

  const { data: lines } = await admin.from('so_lines').select('*').eq('so_id', woId)
  const { data: woParts } = await admin.from('wo_parts').select('*').eq('wo_id', woId)

  // Mirror /api/estimates POST create_from_wo (route.ts:95-106) exactly.
  const estLines: any[] = []
  for (const line of lines || []) {
    if ((line as any).line_type === 'labor') {
      const hrs = (line as any).estimated_hours || (line as any).billed_hours || (line as any).actual_hours || 1
      estLines.push({
        estimate_id: estimateId,
        line_type: 'labor',
        description: (line as any).description,
        quantity: hrs,
        unit_price: laborRate,
        total: hrs * laborRate,
        so_line_id: (line as any).id,
      })
    } else if ((line as any).line_type === 'part' && ((line as any).real_name || (line as any).rough_name || (line as any).description)) {
      const price = (line as any).parts_sell_price || (line as any).unit_price || 0
      estLines.push({
        estimate_id: estimateId,
        line_type: 'part',
        description: (line as any).real_name || (line as any).rough_name || (line as any).description,
        part_number: (line as any).part_number,
        quantity: (line as any).quantity || 1,
        unit_price: price,
        total: ((line as any).quantity || 1) * price,
        so_line_id: (line as any).id,
      })
    }
  }
  for (const part of woParts || []) {
    estLines.push({
      estimate_id: estimateId,
      line_type: 'part',
      description: (part as any).description,
      part_number: (part as any).part_number || null,
      quantity: (part as any).quantity || 1,
      unit_price: (part as any).unit_cost || 0,
      total: ((part as any).quantity || 1) * ((part as any).unit_cost || 0),
      so_line_id: (part as any).line_id || null,
    })
  }

  if (estLines.length === 0) {
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

  const { error: insertErr } = await admin.from('estimate_lines').insert(estLines)
  if (insertErr) {
    console.error('[estimate-snapshot] insert failed', { estimateId, error: insertErr.message })
    return { ok: false, reason: `insert_failed:${insertErr.message}`, created: 0, existed: 0 }
  }

  // Mirror create_from_wo totals formula exactly (route.ts:109-119).
  const laborTotal = estLines.filter((l) => l.line_type === 'labor').reduce((sum, l) => sum + l.total, 0)
  const partsTotal = estLines.filter((l) => l.line_type === 'part').reduce((sum, l) => sum + l.total, 0)
  const sub = laborTotal + partsTotal
  const taxAmt = sub * (taxRate / 100)
  const grandTotal = sub + taxAmt

  await admin
    .from('estimates')
    .update({ labor_total: laborTotal, parts_total: partsTotal, subtotal: sub, tax_amount: taxAmt, grand_total: grandTotal, total: grandTotal })
    .eq('id', estimateId)

  return { ok: true, created: estLines.length, existed: 0 }
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
    .select('line_type, description, total, labor_total, parts_total, line_total')
    .eq('estimate_id', estimateId)
  const labors = ((lines || []) as any[]).filter((l) => l.line_type === 'labor')
  const parts = ((lines || []) as any[]).filter((l) => l.line_type === 'part')
  if (labors.length === 0 && parts.length === 0) {
    return { ok: false, reason: 'no_snapshot_lines', laborCount: 0, partCount: 0, grandTotal: 0 }
  }

  for (const l of labors) {
    if (!l.description || !String(l.description).trim()) {
      return { ok: false, reason: 'labor_missing_description', laborCount: labors.length, partCount: parts.length, grandTotal: 0 }
    }
  }
  for (const p of parts) {
    if (!p.description || !String(p.description).trim()) {
      return { ok: false, reason: 'part_missing_description', laborCount: labors.length, partCount: parts.length, grandTotal: 0 }
    }
  }

  const grand = Number((est as any).grand_total) || Number((est as any).total) || 0
  return { ok: true, laborCount: labors.length, partCount: parts.length, grandTotal: grand }
}
