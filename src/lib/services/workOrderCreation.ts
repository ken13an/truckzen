// Canonical Work Order creation service.
//
// One-and-only-one orchestration of "create a real WO" used by every entry
// point in the system:
//
//   New WO UI       ─┐
//                     → /api/work-orders POST    ─┐
//                                                  → createWorkOrderFromCanonicalInput()
//                                                  →
//   Kiosk Check-In ─┐                              ↑
//                    → Pending Request → Adapter ──┘
//   Service Request─┘
//
// Every WO creation — walk-in, kiosk-converted, service-writer-converted,
// future maintenance/dispatcher/portal-converted — flows through this
// function. There is no other code path that:
//   - calls insertServiceOrder() for WO creation
//   - inserts so_lines for newly-created WO labor/parts
//   - runs the rough-parts inventory match
//   - runs the fallback rough-part heuristic
//   - writes the wo_activity_log "Created work order …" entry
//   - writes the wo.created audit_log entry
//   - fires the estimate-required service-writer notification
//
// Callers own only their own request-shape / source-shape concerns:
//   - normal POST: Zod validation, FK guards, duplicate-WO guard, ownership
//     snapshot, status/estimate_required derivation, response wrapping.
//   - Pending Request adapter: SR row read, ownership snapshot, portal_token
//     carry, source enum mapping, reviewed-line normalization, Note from
//     Customer insert, SR/kiosk_checkins audit closure.
// Everything else is delegated here.

import type { SupabaseClient } from '@supabase/supabase-js'
import { insertServiceOrder } from '@/lib/generateWoNumber'
import { getDefaultLaborHours } from '@/lib/labor-hours'
import { shouldCreateFallbackPart } from '@/lib/parts-suggestions'
import { logAction } from '@/lib/services/auditLog'

export interface CanonicalWorkOrderHeaderInput {
  asset_id: string | null
  customer_id: string | null
  complaint: string
  source: string
  priority: string
  status: string
  submitted_at: string | null
  advisor_id: string | null
  service_writer_id: string | null
  created_by_user_id: string | null
  mileage_at_service?: number | null
  odometer_in?: number | null
  ownership_type: string
  job_type: string
  estimate_required: boolean
  portal_token?: string | null
  origin_service_request_id?: string | null
  // Used only for the estimate-required notification body. Not persisted.
  asset_unit_number?: string | null
}

export interface CanonicalRoughPartInput {
  rough_name?: string
  description?: string
  quantity?: number | string
}

export interface CanonicalJobLineInput {
  description: string
  // null/undefined → service falls back to getDefaultLaborHours(description).
  estimated_hours?: number | null
  required_skills?: string[]
  tire_position?: string | null
  customer_provides_parts?: boolean
  rough_parts?: CanonicalRoughPartInput[]
}

export interface CanonicalWorkOrderCreationOptions {
  // True for /api/work-orders POST when body.status === 'draft'. Skips the
  // labor-line invariant + rollback and the estimate-required notification.
  isDraftSave?: boolean
  // Extra fields merged into the wo.created audit_log details.
  // E.g. for SR convert: { source: 'pending_request_convert', origin_service_request_id, service_request_source }.
  auditDetails?: Record<string, unknown>
  // Override the default wo_activity_log action text.
  // Default: "Created work order ${so_number}" or "Saved draft work order ${so_number}" when isDraftSave.
  activityLogText?: string
  // Default true. Pass false to suppress the notification (e.g. when the
  // caller produces a different downstream notification).
  notifyEstimateRequired?: boolean
}

export interface CanonicalWoCreationSuccess {
  ok: true
  wo: any
}

export interface CanonicalWoCreationFailure {
  ok: false
  error: string
  status: number
  rollback?: 'clean' | 'partial'
}

export type CanonicalWoCreationResult =
  | CanonicalWoCreationSuccess
  | CanonicalWoCreationFailure

// Rollback a just-created WO when child line/parts creation fails. Deletes
// child so_lines then header service_orders row, verifies via re-read, and
// returns a flag indicating whether the cleanup landed cleanly.
async function rollbackNewWO(s: SupabaseClient, woId: string, woNumber: string, _reason: string): Promise<{ clean: boolean }> {
  let childDeleteOk = true
  let headerDeleteOk = true

  const { error: childErr } = await s.from('so_lines').delete().eq('so_id', woId)
  if (childErr) {
    console.error(`[WO ${woNumber}] ROLLBACK: failed to delete child so_lines:`, childErr.message)
    childDeleteOk = false
  }

  const { error: headerErr } = await s.from('service_orders').delete().eq('id', woId)
  if (headerErr) {
    console.error(`[WO ${woNumber}] ROLLBACK: failed to delete WO header:`, headerErr.message)
    headerDeleteOk = false
  }

  let headerGone = false
  let childRowsGone = false
  try {
    const { data: headerCheck } = await s.from('service_orders').select('id').eq('id', woId).maybeSingle()
    headerGone = !headerCheck
    if (headerCheck) {
      console.error(`[WO ${woNumber}] ROLLBACK VERIFICATION FAILED: WO header still exists after delete`)
    }
  } catch (verifyErr: unknown) {
    console.error(`[WO ${woNumber}] ROLLBACK VERIFICATION: header query failed:`, verifyErr instanceof Error ? verifyErr.message : verifyErr)
  }
  try {
    const { data: childCheck } = await s.from('so_lines').select('id').eq('so_id', woId).limit(1)
    childRowsGone = !childCheck || childCheck.length === 0
  } catch {}

  return { clean: childDeleteOk && headerDeleteOk && headerGone && childRowsGone }
}

export async function createWorkOrderFromCanonicalInput(
  s: SupabaseClient,
  shopId: string,
  actorId: string,
  header: CanonicalWorkOrderHeaderInput,
  jobLines: CanonicalJobLineInput[],
  opts: CanonicalWorkOrderCreationOptions = {}
): Promise<CanonicalWoCreationResult> {
  const isDraftSave = opts.isDraftSave === true

  // Step 1: SO header insert via canonical helper. Generates WO-NNN number
  // from next_wo_number RPC (or JS fallback), retries on so_number collision,
  // applies workorder_lane / status_family defaults.
  const { data: wo, error: insertErr } = await insertServiceOrder(s, shopId, {
    asset_id: header.asset_id,
    customer_id: header.customer_id,
    complaint: header.complaint,
    source: header.source,
    priority: header.priority,
    status: header.status,
    submitted_at: header.submitted_at,
    advisor_id: header.advisor_id,
    service_writer_id: header.service_writer_id,
    created_by_user_id: header.created_by_user_id,
    mileage_at_service: header.mileage_at_service ?? null,
    odometer_in: header.odometer_in ?? null,
    ownership_type: header.ownership_type,
    job_type: header.job_type,
    estimate_required: header.estimate_required,
    portal_token: header.portal_token ?? null,
    origin_service_request_id: header.origin_service_request_id ?? null,
  })
  if (insertErr || !wo) {
    return { ok: false, error: insertErr?.message ?? 'Failed to create work order', status: 500 }
  }

  // Step 2: per-line approval defaults from ownership.
  const lineApprovalDefaults = (header.ownership_type === 'owner_operator' || header.ownership_type === 'outside_customer')
    ? { approval_status: 'needs_approval' as const, approval_required: true }
    : { approval_status: 'pre_approved' as const, approval_required: false }

  // Step 3: per-line so_lines insert (labor + rough parts + fallback part).
  let laborLinesCreated = 0
  try {
    for (const line of jobLines) {
      const lineText = (line.description || '').trim()
      if (!lineText) continue
      // Labor hours: explicit value if provided, else keyword-table lookup,
      // else null (mechanic uses Request Hours flow at runtime).
      const explicitHours = (line.estimated_hours !== undefined && line.estimated_hours !== null)
        ? Number(line.estimated_hours)
        : null
      const lineEstimatedHours = (explicitHours !== null && !Number.isNaN(explicitHours))
        ? explicitHours
        : getDefaultLaborHours(lineText)
      const { data: laborLine } = await s.from('so_lines').insert({
        so_id: wo.id,
        line_type: 'labor',
        description: lineText,
        quantity: 0,
        unit_price: 0,
        estimated_hours: lineEstimatedHours,
        line_status: 'unassigned',
        required_skills: line.required_skills || [],
        tire_position: line.tire_position || null,
        customer_provides_parts: line.customer_provides_parts || false,
        ...lineApprovalDefaults,
      }).select('id').single()
      const laborLineId = laborLine?.id || null
      if (laborLineId) laborLinesCreated++

      // Rough parts: per-line inventory match. Conservative — only auto-confirm
      // when the inventory description is the SAME component (rejects sibling
      // and subcomponent matches like "Windshield Seal" for "Windshield").
      const roughParts = Array.isArray(line.rough_parts) ? line.rough_parts : []
      let partsCreated = 0
      for (const rp of roughParts) {
        const partName = rp.rough_name || rp.description || ''
        if (!partName) continue

        const { data: invMatch } = await s.from('parts')
          .select('id, description, part_number, cost_price, sell_price, on_hand')
          .eq('shop_id', shopId)
          .is('deleted_at', null)
          .ilike('description', `%${partName}%`)
          .gt('on_hand', 0)
          .limit(5)

        const partWords = partName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
        const inv = (invMatch || []).find((item: any) => {
          const invWords: string[] = (item.description || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
          if (!partWords.every((w: string) => invWords.some((iw: string) => iw === w || iw === w + 's' || iw + 's' === w))) return false
          const safeExtras = new Set(['assembly', 'assy', 'kit', 'set', 'oem', 'aftermarket', 'heavy', 'duty', 'hd', 'lh', 'rh', 'left', 'right', 'front', 'rear', 'new', 'replacement'])
          const extraWords = invWords.filter((w: string) => !partWords.includes(w) && !partWords.some((pw: string) => w === pw + 's' || w + 's' === pw))
          const unsafeExtras = extraWords.filter((w: string) => !safeExtras.has(w))
          return unsafeExtras.length === 0
        }) || null

        await s.from('so_lines').insert({
          so_id: wo.id,
          line_type: 'part',
          description: partName,
          rough_name: partName,
          real_name: inv ? inv.description : null,
          part_number: inv ? inv.part_number : null,
          quantity: rp.quantity || 1,
          unit_price: inv ? (inv.sell_price || 0) : 0,
          parts_cost_price: inv ? (inv.cost_price || 0) : null,
          parts_sell_price: inv ? (inv.sell_price || 0) : null,
          parts_status: 'rough',
          related_labor_line_id: laborLineId,
          ...lineApprovalDefaults,
        })
        partsCreated++
      }

      // Fallback rough part: only for safely proven part-candidate/material
      // lines (TZBridgeFixAB heuristic). Strips leading action verbs from
      // the labor description and uses the residual as the rough part name.
      if (partsCreated === 0 && shouldCreateFallbackPart(lineText)) {
        const roughName = lineText.replace(/^(replace|install|swap|new|remove\s+and\s+replace|drain\s+and\s+refill)\s+/i, '').trim() || lineText
        await s.from('so_lines').insert({
          so_id: wo.id, line_type: 'part', description: roughName, rough_name: roughName,
          quantity: 1, unit_price: 0, parts_status: 'rough', related_labor_line_id: laborLineId,
          ...lineApprovalDefaults,
        })
      }
    }

    // ══ INVARIANT: at least one labor/job line must be persisted for non-draft WOs ══
    if (!isDraftSave && laborLinesCreated === 0) {
      const rb = await rollbackNewWO(s, wo.id, wo.so_number, 'zero labor lines created')
      return { ok: false, error: 'Failed to create job lines. Work order was not saved. Please try again.', status: 500, rollback: rb.clean ? 'clean' : 'partial' }
    }
  } catch (childErr: unknown) {
    const errMsg = childErr instanceof Error ? childErr.message : String(childErr)
    const rb = await rollbackNewWO(s, wo.id, wo.so_number, `child creation threw: ${errMsg}`)
    return { ok: false, error: 'Failed to create work order lines. Please try again.', status: 500, rollback: rb.clean ? 'clean' : 'partial' }
  }

  // Step 4: wo_activity_log entry. Caller may override the action text (e.g.
  // "Converted pending request to ${so_number}").
  const activityText = opts.activityLogText
    ?? (isDraftSave ? `Saved draft work order ${wo.so_number}` : `Created work order ${wo.so_number}`)
  await s.from('wo_activity_log').insert({
    wo_id: wo.id,
    user_id: actorId || null,
    action: activityText,
  })

  // Step 5: audit_log via logAction. Always action='wo.created'; details
  // get extended by opts.auditDetails so converts can tag pending_request_convert.
  logAction({
    shop_id: shopId,
    user_id: actorId,
    action: 'wo.created',
    entity_type: 'service_order',
    entity_id: wo.id,
    details: { so_number: wo.so_number, ...(opts.auditDetails ?? {}) },
  }).catch(() => {})

  // Step 6: estimate-required notification to service writers. Default on;
  // callers can opt out via opts.notifyEstimateRequired = false.
  const shouldNotify = opts.notifyEstimateRequired !== false
  if (shouldNotify && wo.estimate_required && !isDraftSave) {
    try {
      const { createNotification, getUserIdsByRole } = await import('@/lib/createNotification')
      const writers = await getUserIdsByRole(shopId, ['service_writer', 'service_advisor'])
      const unitNum = header.asset_unit_number || ''
      await createNotification({
        shopId, recipientId: writers, type: 'estimate_required',
        title: 'Estimate Required',
        body: `WO ${wo.so_number} #${unitNum} — build and send estimate before work begins`,
        link: `/work-orders/${wo.id}`,
        relatedWoId: wo.id,
        relatedUnit: unitNum,
        priority: 'high',
      })
    } catch {}
  }

  return { ok: true, wo }
}
