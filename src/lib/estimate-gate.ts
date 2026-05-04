// Server-side estimate-approval gate for service-writer line edits.
//
// Mirrors the UI gate inlined at:
//   src/app/work-orders/[id]/page.tsx:1404-1405 (add-line)
//   src/app/work-orders/[id]/page.tsx:2307-2308 (per-line edit)
// Both UI sites currently inline the same condition. Server consumers
// must use isEstimateGated() so all sites can converge on one truth
// when the UI is migrated in a later patch.

export const ESTIMATE_BYPASS_JOB_TYPES = ['diagnostic', 'full_inspection'] as const

type EstimateGateInput = {
  estimate_required?: boolean | null
  estimate_approved?: boolean | null
  job_type?: string | null
}

export function isEstimateGated(wo: EstimateGateInput | null | undefined): boolean {
  if (!wo) return false
  if (!wo.estimate_required) return false
  if (wo.estimate_approved) return false
  const jt = wo.job_type ?? ''
  if ((ESTIMATE_BYPASS_JOB_TYPES as readonly string[]).includes(jt)) return false
  return true
}
