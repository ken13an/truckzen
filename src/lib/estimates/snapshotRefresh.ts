import { isInvoiceHardLocked } from '@/lib/invoice-lock'
import { buildSnapshotLinesAndTotals } from '@/lib/estimates/snapshotEnsure'

// EXPLICIT ESTIMATE SNAPSHOT REFRESH
//
// One purpose only: rebuild estimate_lines + totals on an OPEN estimate
// from current live so_lines + wo_parts. Mirrors create_from_wo's build
// formula via the shared buildSnapshotLinesAndTotals helper, then performs
// DELETE-then-INSERT plus a totals update on the estimate row.
//
// Refusal contract (no row mutated):
//   estimate_not_found         — id doesn't resolve to an estimate
//   estimate_approved          — terminal status; freeze as historical truth
//   estimate_declined          — terminal status; same freeze rule
//   estimate_has_no_wo         — orphaned estimate row
//   wo_not_found               — parent WO missing
//   wo_is_historical           — read-only Fullbay record
//   wo_invoice_locked          — invoice has been sent/paid/closed
//   updated_at_mismatch        — optimistic concurrency: caller saw a stale
//                                estimate row (caller must reload + retry)
//   no_lines_to_snapshot       — current WO has nothing eligible to snapshot
//   delete_failed:<msg>        — DELETE estimate_lines failed; nothing inserted
//   insert_failed:<msg>        — INSERT failed AFTER the delete; the estimate
//                                ends up with zero lines until next refresh
//
// This helper is NEVER called from the send route. /api/estimates/[id]/send
// remains the canonical send-time ensure point and stays idempotent.

export interface RefreshResult {
  ok: boolean
  reason?: string
  refreshed?: boolean
  inserted?: number
  updated_at?: string | null
}

export async function refreshEstimateSnapshot(
  admin: any,
  estimateId: string,
  expectedUpdatedAt: string | null,
): Promise<RefreshResult> {
  const { data: est } = await admin
    .from('estimates')
    .select('id, shop_id, wo_id, repair_order_id, status, updated_at')
    .eq('id', estimateId)
    .single()
  if (!est) return { ok: false, reason: 'estimate_not_found' }

  const status = String((est as any).status || '').toLowerCase()
  if (status === 'approved') return { ok: false, reason: 'estimate_approved' }
  if (status === 'declined') return { ok: false, reason: 'estimate_declined' }

  if (expectedUpdatedAt && (est as any).updated_at && expectedUpdatedAt !== (est as any).updated_at) {
    return { ok: false, reason: 'updated_at_mismatch' }
  }

  const woId = (est as any).repair_order_id || (est as any).wo_id
  if (!woId) return { ok: false, reason: 'estimate_has_no_wo' }

  const { data: woRow } = await admin
    .from('service_orders')
    .select('id, ownership_type, invoice_status, is_historical, assets(ownership_type)')
    .eq('id', woId)
    .single()
  if (!woRow) return { ok: false, reason: 'wo_not_found' }
  if ((woRow as any).is_historical) return { ok: false, reason: 'wo_is_historical' }
  if (isInvoiceHardLocked((woRow as any).invoice_status)) return { ok: false, reason: 'wo_invoice_locked' }

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
    return { ok: false, reason: 'no_lines_to_snapshot' }
  }

  const { error: delErr } = await admin
    .from('estimate_lines')
    .delete()
    .eq('estimate_id', estimateId)
  if (delErr) {
    console.error('[estimate-refresh] delete failed', { estimateId, error: delErr.message })
    return { ok: false, reason: `delete_failed:${delErr.message}` }
  }

  const { error: insErr } = await admin
    .from('estimate_lines')
    .insert(built.estLines)
  if (insErr) {
    console.error('[estimate-refresh] insert failed', { estimateId, error: insErr.message })
    return { ok: false, reason: `insert_failed:${insErr.message}` }
  }

  const { data: updated } = await admin
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
    .select('updated_at')
    .single()

  return {
    ok: true,
    refreshed: true,
    inserted: built.estLines.length,
    updated_at: (updated as any)?.updated_at ?? null,
  }
}
