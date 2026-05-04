// Canonical invoice-status transition map for /api/work-orders/[id]/invoice.
//
// Each key is an action name accepted by the route; each value is the set of
// invoice_status values from which that action is permitted. The values
// reflect the workflow as it exists today, including transitional aliases
// ('pending_accounting', 'accounting_approved', 'sent_to_customer') that
// older rows may still carry. Centralized here so the API route and any
// future callers (regression tests, downstream consumers) share one source
// of truth instead of drifting copies.
//
// Sibling truth: hard-lock states (sent / paid / closed) live in
// src/lib/invoice-lock.ts under HARD_LOCKED_STATUSES. That module owns
// "is this invoice frozen?"; this module owns "from which states does this
// action advance?". They intentionally overlap on the locked tail — keep
// them aligned, do not collapse.

export const INVOICE_TRANSITIONS: Record<string, readonly string[]> = {
  submit_to_accounting: ['', 'draft', 'quality_check_failed'],
  approve_invoicing: ['accounting_review', 'pending_accounting', 'accounting_approved'],
  mark_paid: ['sent', 'sent_to_customer'],
  close_wo: ['paid'],
}

// Returns true if `action` is permitted when invoice_status === `currentStatus`.
// Unknown actions return true so the route's own validation (e.g. "Invalid
// action" 400) remains the only authority for action-name correctness.
// Null / undefined current status is normalized to the empty-string bucket
// the route already uses (`wo.invoice_status || ''`).
export function canTransitionInvoiceStatus(
  action: string,
  currentStatus: string | null | undefined,
): boolean {
  const allowed = INVOICE_TRANSITIONS[action]
  if (!allowed) return true
  return allowed.includes(currentStatus ?? '')
}
