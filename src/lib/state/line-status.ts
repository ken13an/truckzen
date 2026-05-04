// Canonical so_lines.line_status truth.
//
// Single importable source for both the runtime value list (used by the API
// validator in src/app/api/so-lines/[id]/route.ts) and the LineStatus type
// (re-exported from src/types/workOrder.ts so consumers reading WOLine still
// get the right shape).
//
// Sibling truth: parts_status lives in src/lib/parts-status.ts. Line-status
// previously lived alongside it; the file name made discoverability worse
// because line-status is not parts truth — it is the labor/job assignment
// progression on a so_lines row. Centralizing here removes the competing
// type that was sitting in src/types/workOrder.ts and stops parts-status.ts
// from carrying two different status workflows.

export const VALID_LINE_STATUSES = [
  'unassigned',
  'pending_review',
  'approved',
  'in_progress',
  'completed',
] as const

export type LineStatus = typeof VALID_LINE_STATUSES[number]
