/**
 * TruckZen — Canonical Parts Status Truth
 * Single source of truth for so_lines.parts_status workflow states.
 * Do NOT duplicate these values inline — import from here.
 */

// All valid parts_status values for so_lines
export const VALID_PARTS_STATUSES = [
  'rough',
  'sourced',
  'ordered',
  'received',
  'ready_for_job',
  'picked_up',
  'installed',
  'canceled',
] as const

export type PartsStatus = typeof VALID_PARTS_STATUSES[number]

// Mechanic pickup/receipt: the status set when mechanic confirms parts receipt
export const PARTS_PICKUP_STATUS: PartsStatus = 'picked_up'

// Parts ready for mechanic pickup
export const PARTS_READY_STATUS: PartsStatus = 'ready_for_job'

/**
 * Canonical "parts received or later" classifier (Patch 125).
 * A part is considered "received" for WO aggregate, invoice-gate, stepper,
 * and floor-manager blocking purposes once it is in any stage at or past
 * parts-dept receipt. picked_up and installed are post-received and must
 * count as received. Drift historically flared when callers omitted
 * picked_up — this constant is the single source of truth.
 */
export const PARTS_RECEIVED_STATES: readonly PartsStatus[] = ['received', 'ready_for_job', 'picked_up', 'installed']

export function isPartReceived(status: string | null | undefined): boolean {
  if (!status) return false
  return (PARTS_RECEIVED_STATES as readonly string[]).includes(status)
}

// All valid line_status values for so_lines
export const VALID_LINE_STATUSES = [
  'unassigned',
  'pending_review',
  'approved',
  'in_progress',
  'completed',
] as const

export type LineStatus = typeof VALID_LINE_STATUSES[number]
