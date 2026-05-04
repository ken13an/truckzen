/**
 * TruckZen — Canonical Parts Status Truth
 * Single source of truth for so_lines.parts_status workflow states.
 * Do NOT duplicate these values inline — import from here.
 */
import { getAutoRoughParts } from './parts-suggestions'

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

// Line-status truth lives in src/lib/state/line-status.ts. Re-exported here
// for one release so the existing so-lines route import path stays valid;
// new code should import from '@/lib/state/line-status' directly. Relative
// import path used so the regression suite (vitest, no alias config) can
// follow this transitively when helper-behavior.test.ts imports parts-status.
export { VALID_LINE_STATUSES, type LineStatus } from './state/line-status'

/**
 * Server-side close-job guard for parts movement truth.
 *
 * Reads the so_lines per-line projection columns added by the movement
 * schema patch (reserved_qty / picked_up_qty / installed_qty /
 * returned_unused_qty) and blocks completion of a line when parts on
 * that line — or any child part line linked via related_labor_line_id —
 * are still reserved (not yet picked up or released) or still picked up
 * (not yet installed or returned). installed_qty and returned_unused_qty
 * are terminal states and never block.
 *
 * Returns { blocked: false } when safe to complete; { blocked: true,
 * message } with the canonical user-facing error when not. The caller
 * (route handler) is responsible for returning the error response.
 */
export async function checkPartMovementUnresolvedForLine(
  admin: any,
  lineId: string,
): Promise<{ blocked: boolean; message: string | null }> {
  const { data: rows } = await admin.from('so_lines')
    .select('line_type, reserved_qty, picked_up_qty')
    .or(`id.eq.${lineId},related_labor_line_id.eq.${lineId}`)
  let totalReserved = 0
  let totalPickedUp = 0
  for (const r of (rows || []) as Array<{ line_type?: string; reserved_qty?: number; picked_up_qty?: number }>) {
    if (r.line_type !== 'part') continue
    totalReserved += Number(r.reserved_qty || 0)
    totalPickedUp += Number(r.picked_up_qty || 0)
  }
  if (totalReserved <= 0 && totalPickedUp <= 0) {
    return { blocked: false, message: null }
  }
  const segments: string[] = []
  if (totalReserved > 0) segments.push(`reserved (${totalReserved})`)
  if (totalPickedUp > 0) segments.push(`picked up (${totalPickedUp})`)
  return {
    blocked: true,
    message: `Cannot complete this job line: parts are still ${segments.join(' and ')}. Confirm install or return unused parts first.`,
  }
}

// Typed parts-requirement signal on labor so_lines. Used by the estimate
// approval gate to distinguish "labor-only by design" from "writer forgot to
// add required parts". Stored as so_lines.parts_requirement (nullable).
export const VALID_PARTS_REQUIREMENTS = [
  'needed',
  'customer_supplied',
  'not_needed',
  'override',
] as const
export type PartsRequirement = typeof VALID_PARTS_REQUIREMENTS[number]

// Canonical deterministic notes used when the Parts-tab confirm flow marks a
// row customer_supplied or not_needed without typed input. Server validator
// requires a non-empty parts_requirement_note for both states; these default
// values satisfy it. Exported so UI code can import instead of hardcoding.
export const PARTS_REQUIREMENT_DEFAULT_NOTES: Record<Exclude<PartsRequirement, 'needed' | 'override'>, string> = {
  customer_supplied: 'Customer supplied part',
  not_needed: 'No part needed',
}
// Confirmation dialog copy for the same chip handlers. Kept here so the UI
// doesn't carry hardcoded customer-facing strings.
export const PARTS_REQUIREMENT_CONFIRM_COPY: Record<Exclude<PartsRequirement, 'needed' | 'override'>, string> = {
  customer_supplied: 'Mark this part as customer supplied? This part will be non-billable and shown on the job/invoice as customer supplied. Shop is not responsible for customer-supplied part defect/warranty.',
  not_needed: 'Mark this part as no part needed? This placeholder will be non-billable and shown on the job/invoice as no part needed.',
}

// Roles permitted to set parts_requirement='override'. Kept in sync with
// src/app/api/work-orders/[id]/override-estimate-block/route.ts so per-labor
// override mirrors the WO-level override.
export const PARTS_OVERRIDE_ROLES: readonly string[] = ['owner', 'gm', 'it_person', 'shop_manager']

export type GateFailureReason =
  | 'missing_parts_requirement'
  | 'needed_without_child_part'
  | 'needed_without_priced_child_part'
  | 'customer_supplied_missing_note'
  | 'override_missing_note'
  | 'override_missing_role'
  | 'child_customer_supplied_missing_note'
  | 'child_not_needed_missing_note'
  | 'child_unresolved'

export type GateFailure = { line_id: string; description: string | null; reason: GateFailureReason }
export type GateResult = { ok: true } | { ok: false; failures: GateFailure[] }

/**
 * Canonical "is this shop part estimate-priced?" predicate. Mirrors the Estimate
 * tab / invoice-calc customer-facing price expression (parts_sell_price ||
 * unit_price). A requested/preparing row with $0.00 is NOT estimate-ready.
 */
export function isShopPartPriced(part: { parts_sell_price?: number | null; unit_price?: number | null }): boolean {
  const sell = Number(part?.parts_sell_price ?? part?.unit_price ?? 0)
  return Number.isFinite(sell) && sell > 0
}

/**
 * Non-billable part classifiers. When a required part placeholder is resolved
 * as customer_supplied or not_needed on the row itself, the row must stay in
 * the DB for audit but MUST be excluded from billable totals, from the normal
 * estimate/invoice priced-parts list, and surfaced as a stamp instead.
 */
export function isCustomerSuppliedPartRow(line: { line_type?: string | null; parts_requirement?: string | null }): boolean {
  return line?.line_type === 'part' && line?.parts_requirement === 'customer_supplied'
}
export function isNoPartNeededPartRow(line: { line_type?: string | null; parts_requirement?: string | null }): boolean {
  return line?.line_type === 'part' && line?.parts_requirement === 'not_needed'
}
export function isNonBillablePartRequirementRow(line: { line_type?: string | null; parts_requirement?: string | null }): boolean {
  return isCustomerSuppliedPartRow(line) || isNoPartNeededPartRow(line)
}

/**
 * Shared estimate-approval parts gate. Every approval path that flips an
 * estimate to 'approved' must call this first. Blocks when any non-canceled
 * labor so_line has an unresolved parts_requirement.
 *
 * For parts_requirement='needed', a labor line is only resolved when it has
 * at least one linked non-canceled child part row whose customer-facing sell
 * price > 0. A requested/preparing row with $0.00 does NOT satisfy the gate —
 * the estimate cannot be sent to a customer without a priced shop part.
 */
export async function assertPartsRequirementResolved(
  admin: any,
  soId: string,
  actorRole: string,
): Promise<GateResult> {
  const { data: labor } = await admin
    .from('so_lines')
    .select('id, description, parts_requirement, parts_requirement_note, parts_status, line_status')
    .eq('so_id', soId)
    .eq('line_type', 'labor')
  const laborRows = (labor || []).filter((l: any) => l.parts_status !== 'canceled' && l.line_status !== 'canceled')
  if (laborRows.length === 0) return { ok: true }

  const { data: parts } = await admin
    .from('so_lines')
    .select('id, related_labor_line_id, parts_status, parts_sell_price, unit_price, parts_requirement, parts_requirement_note, description, rough_name, real_name')
    .eq('so_id', soId)
    .eq('line_type', 'part')

  // Linked wo_parts rows per labor line — needed by the false-positive
  // labor-only relaxation (ExistingFalsePartRequirement_Cleanup_Fix). A
  // labor line that the writer manually added a billable wo_parts row to
  // must NOT be auto-resolved even if the verb-intent classifier would
  // otherwise treat it as labor-only.
  const { data: woPartsData } = await admin
    .from('wo_parts')
    .select('line_id, status')
    .eq('wo_id', soId)
  const woPartsByLine = new Map<string, number>()
  for (const wp of (woPartsData || []) as Array<{ line_id?: string | null; status?: string | null }>) {
    if (!wp.line_id) continue
    if (wp.status === 'canceled') continue
    woPartsByLine.set(wp.line_id, (woPartsByLine.get(wp.line_id) || 0) + 1)
  }
  // Canonical false-positive labor-only check
  // (ExistingFalsePartRequirement_Cleanup_Fix). When a labor line says
  // parts_requirement='needed' (or null) but has zero linked child rows
  // AND zero linked wo_parts rows AND its description has no non-labor
  // part candidates per getAutoRoughParts, the auto-defaulted requirement
  // is a false positive. Treat such lines as labor-only resolved so
  // legacy "repair bumper"-style rows persisted before
  // RepairVerb_NoAutoPartsRequirement_Fix stop blocking approval.
  const isAutoLaborOnly = (l: any): boolean => {
    if ((woPartsByLine.get(l.id) || 0) > 0) return false
    return !getAutoRoughParts(l.description || '').some((p: any) => !p.is_labor)
  }

  // Bucket non-canceled children per labor line. The "needed" path requires
  // every non-canceled child to be individually resolved at the row level:
  //   - priced shop-supplied (parts_sell_price || unit_price > 0) with no
  //     explicit parts_requirement or 'needed'
  //   - parts_requirement='customer_supplied' AND a non-empty note
  //   - parts_requirement='not_needed' AND a non-empty note
  //   - parts_requirement='override' AND note AND manager role
  const childrenByLabor = new Map<string, any[]>()
  for (const p of parts || []) {
    if (!p.related_labor_line_id) continue
    if (p.parts_status === 'canceled') continue
    const arr = childrenByLabor.get(p.related_labor_line_id) || []
    arr.push(p)
    childrenByLabor.set(p.related_labor_line_id, arr)
  }

  type ChildResolution =
    | { resolved: true }
    | { resolved: false; reason: GateFailureReason }
  const resolveChild = (p: any, canOverrideActor: boolean): ChildResolution => {
    const pReq = p.parts_requirement
    const pNote = typeof p.parts_requirement_note === 'string' ? p.parts_requirement_note.trim() : ''
    if (pReq === 'customer_supplied') {
      return pNote ? { resolved: true } : { resolved: false, reason: 'child_customer_supplied_missing_note' }
    }
    if (pReq === 'not_needed') {
      return pNote ? { resolved: true } : { resolved: false, reason: 'child_not_needed_missing_note' }
    }
    if (pReq === 'override') {
      if (!pNote) return { resolved: false, reason: 'override_missing_note' }
      if (!canOverrideActor) return { resolved: false, reason: 'override_missing_role' }
      return { resolved: true }
    }
    // Default / 'needed' on the child row → shop-supplied: must be priced.
    return isShopPartPriced(p) ? { resolved: true } : { resolved: false, reason: 'needed_without_priced_child_part' }
  }

  const canOverride = PARTS_OVERRIDE_ROLES.includes(actorRole)
  const failures: GateFailure[] = []
  // Validate the linked child rows for a labor line whose effective
  // requirement is 'needed'. Shared between explicit req='needed' and the
  // null-labor-with-linked-children default path below.
  const validateNeededChildren = (l: any): GateFailure | null => {
    const children = childrenByLabor.get(l.id) || []
    if (children.length === 0) {
      if (isAutoLaborOnly(l)) return null
      return { line_id: l.id, description: l.description, reason: 'needed_without_child_part' }
    }
    for (const p of children) {
      const r = resolveChild(p, canOverride)
      if (!r.resolved) return { line_id: l.id, description: l.description, reason: r.reason }
    }
    return null
  }
  for (const l of laborRows) {
    const req = l.parts_requirement
    const note = typeof l.parts_requirement_note === 'string' ? l.parts_requirement_note.trim() : ''
    if (!req) {
      // Parts tab owns part-row truth. Pre-existing labor rows predate the
      // addJobLine auto-set, so a null labor requirement with at least one
      // non-canceled linked child part is treated as effective 'needed' and
      // the gate defers to child-row validation. Null + no linked children
      // still blocks — writer must resolve via Parts tab.
      const children = childrenByLabor.get(l.id) || []
      if (children.length === 0) {
        if (isAutoLaborOnly(l)) continue
        failures.push({ line_id: l.id, description: l.description, reason: 'missing_parts_requirement' })
        continue
      }
      const blocked = validateNeededChildren(l)
      if (blocked) failures.push(blocked)
      continue
    }
    if (req === 'needed') {
      const blocked = validateNeededChildren(l)
      if (blocked) failures.push(blocked)
      continue
    }
    if (req === 'customer_supplied') {
      if (!note) failures.push({ line_id: l.id, description: l.description, reason: 'customer_supplied_missing_note' })
      continue
    }
    if (req === 'not_needed') continue
    if (req === 'override') {
      if (!note) failures.push({ line_id: l.id, description: l.description, reason: 'override_missing_note' })
      else if (!canOverride) failures.push({ line_id: l.id, description: l.description, reason: 'override_missing_role' })
      continue
    }
    failures.push({ line_id: l.id, description: l.description, reason: 'missing_parts_requirement' })
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures }
}
