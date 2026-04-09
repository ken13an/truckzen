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

// All valid line_status values for so_lines
export const VALID_LINE_STATUSES = [
  'unassigned',
  'pending_review',
  'approved',
  'in_progress',
  'completed',
] as const

export type LineStatus = typeof VALID_LINE_STATUSES[number]
