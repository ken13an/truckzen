// Pending Request → canonical WO adapter.
//
// Architecture:
//
//   Kiosk Check-In   ─┐
//                      → Pending Request → Adapter → createWorkOrderFromCanonicalInput() → Real WO
//   Service Request  ─┘
//
// Raw intake sources (kiosk_checkins, service_writer service_requests, future
// maintenance/dispatcher/customer-portal sources) all land in service_requests.
// The service writer reviews them on /service-requests/[id] and presses
// Convert. Convert flows through this adapter, which:
//
//   1. parses + validates reviewed lines
//   2. snapshots ownership_type from the linked asset
//   3. derives canonical WO defaults (status, estimate_required, source enum)
//   4. carries the kiosk portal_token onto the new SO
//   5. hands off to createWorkOrderFromCanonicalInput() — the same canonical
//      service /api/work-orders POST uses, so converted WOs use the SAME
//      WO-NNN numbering, the SAME workorder_lane / status_family defaults,
//      the SAME so_lines insert with getDefaultLaborHours + approval defaults,
//      the SAME rough-parts inventory match, the SAME wo_activity_log entry,
//      the SAME wo.created audit log
//   6. inserts the customer-visible "Note from Customer" via wo_notes (post-
//      creation, fail-close)
//   7. closes the bidirectional audit trail (origin_service_request_id is on
//      the SO header; converted_so_id + status='converted' on the SR + linked
//      kiosk_checkins)
//
// No raw intake source is allowed to bypass createWorkOrderFromCanonicalInput
// with its own service_orders.insert(...). Future sources should call
// applyPendingRequestConversion() instead of duplicating WO creation.

import type { SupabaseClient } from '@supabase/supabase-js'
import { srSourceToSoSource } from '@/lib/services/serviceOrderSource'
import {
  createWorkOrderFromCanonicalInput,
  type CanonicalWorkOrderHeaderInput,
  type CanonicalJobLineInput,
} from '@/lib/services/workOrderCreation'

export interface ReviewedJobLineInput {
  description: string
}

export interface PendingRequestConversionContext {
  actor: { id: string }
}

export interface PendingRequestConversionSuccess {
  ok: true
  so_id: string
  so_number: string
}

export interface PendingRequestConversionFailure {
  ok: false
  error: string
  status?: number
}

export type PendingRequestConversionResult =
  | PendingRequestConversionSuccess
  | PendingRequestConversionFailure

// Parse the reviewed_lines payload from a convert request. Trims, length-
// caps, drops empties, array-caps. Length cap matches kiosk-checkin write
// path (500 chars/line, 25 lines max). Accepts string-or-object items
// from prior schema variants for forgiveness.
export function parseReviewedLines(raw: unknown): ReviewedJobLineInput[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((l: any) => {
      const desc = typeof l === 'string'
        ? l
        : typeof l?.description === 'string' ? l.description : ''
      return { description: desc.trim().slice(0, 500) }
    })
    .filter(l => l.description.length > 0)
    .slice(0, 25)
}

// Validator chain for reviewed lines. Returns null if valid, or a single
// HTTP-friendly error message. Future validators (tire-position-required
// for generic tire jobs, generic-keyword-needs-clarification, duplicate
// detection) plug in here without touching the route handler.
export function validateReviewedLines(lines: ReviewedJobLineInput[]): string | null {
  if (lines.length === 0) {
    return 'Add at least one reviewed job line before converting this request.'
  }
  // Future validators can require tire position for generic tire jobs.
  return null
}

// Pure shape derivation: SR row + ownership snapshot + token + ctx →
// the CanonicalWorkOrderHeaderInput accepted by the shared creation
// service. No DB I/O.
export function buildCanonicalWoInputFromServiceRequest(params: {
  sr: {
    id: string
    asset_id: string | null
    customer_id: string | null
    description: string | null
    source: string | null
    unit_number?: string | null
  }
  ownership: string
  jobType: string
  estimateRequired: boolean
  status: string
  portalTokenCarry: string | null
  ctx: PendingRequestConversionContext
}): CanonicalWorkOrderHeaderInput {
  const { sr, ownership, jobType, estimateRequired, status, portalTokenCarry, ctx } = params
  return {
    asset_id: sr.asset_id || null,
    customer_id: sr.customer_id || null,
    complaint: sr.description ?? '',
    source: srSourceToSoSource(sr.source),
    priority: 'normal',
    status,
    submitted_at: new Date().toISOString(),
    advisor_id: ctx.actor.id,
    service_writer_id: ctx.actor.id,
    created_by_user_id: ctx.actor.id,
    ownership_type: ownership,
    job_type: jobType,
    estimate_required: estimateRequired,
    portal_token: portalTokenCarry,
    origin_service_request_id: sr.id,
    asset_unit_number: sr.unit_number ?? null,
  }
}

// Orchestrates the full conversion. Fails closed: if canonical WO creation
// fails, return the error. If wo_notes insert fails after WO creation
// succeeded, return error before marking the SR converted. The orphan SO
// row left behind on a Note-failure is acceptable — the SR/kiosk_checkin
// linkage stays honest so a retry from a clean state is possible.
export async function applyPendingRequestConversion(params: {
  s: SupabaseClient
  sr: any
  reviewedLines: ReviewedJobLineInput[]
  ctx: PendingRequestConversionContext
}): Promise<PendingRequestConversionResult> {
  const { s, sr, reviewedLines, ctx } = params

  // Snapshot ownership_type from the linked asset. Same pattern as
  // /api/work-orders POST; falls back to 'fleet_asset' if no asset is
  // attached or asset has no ownership data.
  let ownership = 'fleet_asset'
  if (sr.asset_id) {
    const { data: assetData } = await s.from('assets').select('ownership_type, is_owner_operator').eq('id', sr.asset_id).single()
    if (assetData?.ownership_type) ownership = assetData.ownership_type
    if (assetData?.is_owner_operator) ownership = 'owner_operator'
  }
  const jobType = 'repair'
  const estimateRequired =
    (ownership === 'owner_operator' || ownership === 'outside_customer')
      && !['diagnostic', 'full_inspection'].includes(jobType)
  // Mirror normal /api/work-orders create on submit: fleet_asset goes
  // straight to in_progress; owner_operator / outside_customer goes to
  // waiting_approval so the estimate-approval gate fires before mechanic
  // assignment readies.
  const status = ownership === 'fleet_asset' ? 'in_progress' : 'waiting_approval'

  // Carry the kiosk portal token if upstream so the customer's existing
  // /portal/<token> link continues to work after conversion.
  let portalTokenCarry: string | null = null
  if (sr.kiosk_checkin_id) {
    const { data: kc } = await s.from('kiosk_checkins')
      .select('id, shop_id, portal_token, status')
      .eq('id', sr.kiosk_checkin_id)
      .eq('shop_id', sr.shop_id)
      .maybeSingle()
    if (kc?.portal_token) portalTokenCarry = kc.portal_token
  }

  const header = buildCanonicalWoInputFromServiceRequest({
    sr, ownership, jobType, estimateRequired, status, portalTokenCarry, ctx,
  })
  const jobLines: CanonicalJobLineInput[] = reviewedLines.map(l => ({ description: l.description }))

  const result = await createWorkOrderFromCanonicalInput(s, sr.shop_id, ctx.actor.id, header, jobLines, {
    isDraftSave: false,
    auditDetails: {
      source: 'pending_request_convert',
      origin_service_request_id: sr.id,
      service_request_source: sr.source,
    },
    notifyEstimateRequired: true,
  })

  if (!result.ok) {
    return { ok: false, error: result.error, status: result.status }
  }
  const wo = result.wo
  const activityLogText = `Converted pending request to ${wo.so_number}`
  // Append a convert-specific wo_activity_log line so the activity feed
  // shows the conversion provenance alongside the canonical "Created"
  // line written by the service. Best-effort.
  s.from('wo_activity_log').insert({
    wo_id: wo.id,
    user_id: ctx.actor.id,
    action: activityLogText,
  }).then(() => {}, () => {})

  // Customer-visible "Note from Customer" preserves the original request
  // text separate from any reviewed job lines. Fail-close: if the note
  // insert fails after the SO insert, return error before marking the SR
  // converted (the orphan SO row is acceptable; the SR/kc linkage stays
  // honest so a retry from a clean state is always possible).
  const customerNoteText = (sr.description ?? '').trim()
  if (customerNoteText) {
    const { error: noteErr } = await s.from('wo_notes').insert({
      wo_id: wo.id,
      user_id: ctx.actor.id,
      note_text: `Note from Customer: ${customerNoteText}`,
      visible_to_customer: true,
    })
    if (noteErr) {
      return { ok: false, error: 'Failed to preserve customer note: ' + noteErr.message, status: 500 }
    }
  }

  // Mark the SR converted (only after the canonical WO + Note succeeded).
  await s.from('service_requests').update({ status: 'converted', converted_so_id: wo.id }).eq('id', sr.id)

  // Mirror onto the linked kiosk_checkins audit row.
  if (sr.kiosk_checkin_id) {
    await s.from('kiosk_checkins').update({ converted_so_id: wo.id, status: 'converted' }).eq('id', sr.kiosk_checkin_id)
  }

  return { ok: true, so_id: wo.id, so_number: wo.so_number }
}
