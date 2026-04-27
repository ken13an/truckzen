// Pending Request → canonical WO adapter.
//
// Architecture:
//
//   Kiosk Check-In   ─┐
//                      → Pending Request → Adapter → insertServiceOrder() → Real WO
//   Service Request  ─┘
//
// Raw intake sources (kiosk_checkins, service_requests created by service
// writers, future maintenance/dispatcher/customer-portal sources) all land
// in service_requests. The service writer reviews them on
// /service-requests/[id] and presses Convert. Convert flows through this
// adapter, which:
//
//   1. parses + validates reviewed lines
//   2. snapshots ownership_type from the linked asset
//   3. derives canonical WO defaults (status, estimate_required, source enum)
//   4. hands off to insertServiceOrder() — the same canonical helper
//      /api/work-orders POST uses, so converted WOs use the same WO-NNNNNN
//      number sequence, the same lane/family defaults, and the same retry
//      semantics as walk-in WOs
//   5. inserts the customer-visible "Note from Customer" via wo_notes
//   6. inserts reviewed job lines with normal-create defaults
//      (getDefaultLaborHours + ownership-derived approval flags)
//   7. closes the bidirectional audit trail (origin_service_request_id on
//      the SO; converted_so_id + status='converted' on SR + linked
//      kiosk_checkins)
//   8. logs wo.created tagged with source='pending_request_convert'
//
// No raw intake source is allowed to bypass this adapter with its own
// service_orders.insert(...). Future sources should call
// applyPendingRequestConversion() instead of duplicating WO creation.

import type { SupabaseClient } from '@supabase/supabase-js'
import { insertServiceOrder } from '@/lib/generateWoNumber'
import { getDefaultLaborHours } from '@/lib/labor-hours'
import { logAction } from '@/lib/services/auditLog'
import { srSourceToSoSource } from '@/lib/services/serviceOrderSource'

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
// the payload insertServiceOrder accepts. No DB I/O. Mirrors the field
// set /api/work-orders POST passes to the same helper.
export function buildCanonicalWoInputFromServiceRequest(params: {
  sr: {
    id: string
    asset_id: string | null
    customer_id: string | null
    description: string | null
    source: string | null
  }
  ownership: string
  jobType: string
  estimateRequired: boolean
  status: string
  portalTokenCarry: string | null
  ctx: PendingRequestConversionContext
}): Record<string, unknown> {
  const { sr, ownership, jobType, estimateRequired, status, portalTokenCarry, ctx } = params
  return {
    asset_id: sr.asset_id || null,
    customer_id: sr.customer_id || null,
    complaint: sr.description,
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
  }
}

// Orchestrates the full conversion. Fails closed: if SO insert fails,
// or wo_notes insert fails, or so_lines insert fails, return an error
// before marking the SR converted, so a retry from a clean state is
// always possible. The orphan SO row left behind on a partial failure
// is acceptable — the SR/kiosk_checkin linkage stays honest.
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

  const canonicalInput = buildCanonicalWoInputFromServiceRequest({
    sr, ownership, jobType, estimateRequired, status, portalTokenCarry, ctx,
  })

  const { data: so, error: soErr } = await insertServiceOrder(s, sr.shop_id, canonicalInput)
  if (soErr || !so) {
    return { ok: false, error: soErr?.message ?? 'Failed to create work order', status: 500 }
  }

  // Customer-visible "Note from Customer" preserves the original request
  // text separate from any reviewed job lines.
  const customerNoteText = (sr.description ?? '').trim()
  if (customerNoteText) {
    const { error: noteErr } = await s.from('wo_notes').insert({
      wo_id: so.id,
      user_id: ctx.actor.id,
      note_text: `Note from Customer: ${customerNoteText}`,
      visible_to_customer: true,
    })
    if (noteErr) {
      return { ok: false, error: 'Failed to preserve customer note: ' + noteErr.message, status: 500 }
    }
  }

  // Reviewed job lines with normal-create defaults: hours lookup +
  // approval defaults gated by ownership. Same shape /api/work-orders
  // POST writes per line.
  if (reviewedLines.length > 0) {
    const lineApprovalDefaults = (ownership === 'owner_operator' || ownership === 'outside_customer')
      ? { approval_status: 'needs_approval' as const, approval_required: true }
      : { approval_status: 'pre_approved' as const, approval_required: false }
    const linesPayload = reviewedLines.map(l => ({
      so_id: so.id,
      line_type: 'labor' as const,
      description: l.description,
      quantity: 0,
      unit_price: 0,
      estimated_hours: getDefaultLaborHours(l.description),
      line_status: 'unassigned' as const,
      ...lineApprovalDefaults,
    }))
    const { error: linesErr } = await s.from('so_lines').insert(linesPayload)
    if (linesErr) {
      return { ok: false, error: 'Failed to create reviewed job lines: ' + linesErr.message, status: 500 }
    }
  }

  // Mark the SR converted (only after note + lines succeeded).
  await s.from('service_requests').update({ status: 'converted', converted_so_id: so.id }).eq('id', sr.id)

  // Mirror onto the linked kiosk_checkins audit row.
  if (sr.kiosk_checkin_id) {
    await s.from('kiosk_checkins').update({ converted_so_id: so.id, status: 'converted' }).eq('id', sr.kiosk_checkin_id)
  }

  // Same wo.created audit entry that normal /api/work-orders create writes,
  // tagged with the SR origin so the audit trail distinguishes pending-
  // request conversions from walk-in WO creations.
  logAction({
    shop_id: sr.shop_id,
    user_id: ctx.actor.id,
    action: 'wo.created',
    entity_type: 'service_order',
    entity_id: so.id,
    details: {
      so_number: so.so_number,
      source: 'pending_request_convert',
      origin_service_request_id: sr.id,
      service_request_source: sr.source,
    },
  }).catch(() => {})

  return { ok: true, so_id: so.id, so_number: so.so_number }
}
