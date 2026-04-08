/**
 * TruckZen — Invoice Lock Truth
 * One source of truth for invoice editability rules.
 *
 * Stages:
 *   draft / quality_check_failed → fully editable by service/parts
 *   accounting_review → editable by accounting/full-WO roles only
 *   sent → locked (invoice sent to customer)
 *   paid → locked
 *   closed → locked
 *
 * Reopen: only owner/gm/it can reopen a sent/paid invoice back to accounting_review
 */

import { ACCOUNTING_ROLES, INVOICE_ACTION_ROLES as _INVOICE_ACTION_ROLES } from '@/lib/roles'

// Statuses where NO edits are allowed (customer has received invoice)
export const HARD_LOCKED_STATUSES = ['sent', 'paid', 'closed']

// Statuses where only accounting/full-WO roles can edit
export const ACCOUNTING_EDIT_STATUSES = ['accounting_review']

// Re-export from shared source — same members as ACCOUNTING_ROLES
export const ACCOUNTING_EDIT_ROLES = ACCOUNTING_ROLES

// Re-export from shared source
export const INVOICE_ACTION_ROLES = _INVOICE_ACTION_ROLES

// Emergency fallback labor rate — used only when shop has no rate configured at all
export const DEFAULT_LABOR_RATE_FALLBACK = 125

// Re-export from shared source — same members as ACCOUNTING_ROLES
export const REOPEN_ROLES = ACCOUNTING_ROLES

/**
 * Check if invoice is hard-locked (sent/paid/closed — no edits at all)
 */
export function isInvoiceHardLocked(invoiceStatus: string | null | undefined): boolean {
  return !!invoiceStatus && HARD_LOCKED_STATUSES.includes(invoiceStatus)
}

/**
 * Check if invoice is in accounting-edit stage
 */
export function isInAccountingReview(invoiceStatus: string | null | undefined): boolean {
  return invoiceStatus === 'accounting_review'
}

/**
 * Check if a role can edit during the current invoice stage
 */
export function canEditInvoice(invoiceStatus: string | null | undefined, effectiveRole: string): boolean {
  if (!invoiceStatus || ['', 'draft', 'quality_check_failed'].includes(invoiceStatus)) return true // pre-invoice: anyone with page access
  if (isInAccountingReview(invoiceStatus)) return ACCOUNTING_EDIT_ROLES.includes(effectiveRole)
  return false // sent/paid/closed: locked
}

/**
 * Check if a role can reopen a locked invoice
 */
export function canReopenInvoice(invoiceStatus: string | null | undefined, effectiveRole: string): boolean {
  if (!invoiceStatus || !HARD_LOCKED_STATUSES.includes(invoiceStatus)) return false // not locked, nothing to reopen
  return REOPEN_ROLES.includes(effectiveRole)
}
