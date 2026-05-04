// Request-body validation for /api/work-orders/[id] PATCH.
//
// Mirrors the route's existing accept-set verbatim. The route already enforces
// per-field typeof checks and a 5000-char string cap inline; this schema adds
// what those checks don't catch:
//   - status / priority bound to the WOStatus / WOPriority unions in
//     src/types/workOrder.ts (the route's transition map covers status only
//     when currentStatus is a key in VALID_WO_TRANSITIONS, leaving values
//     like 'not_approved', 'ready_final_inspection', 'failed_inspection',
//     'void' unguarded; the schema closes that gap)
//   - grand_total enforced as a finite number (typeof check passes NaN)
//   - id fields enforced as uuid (route already does cross-shop FK check;
//     uuid format check fails the request faster with a clearer message)
// Free-form fields (team, bay, estimate_status, approval_method, date strings)
// stay as bounded strings — no canonical const enum exists in code to bind to
// without invention. Transition guard at route lines 247-261 stays the
// authority on allowed status transitions; this schema only validates body
// shape.

import { NextResponse } from 'next/server'
import { z } from 'zod'

const numFinite = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().finite(),
)

// Mirrors src/types/workOrder.ts:1
export const WOStatusEnum = z.enum([
  'draft',
  'not_approved',
  'waiting_approval',
  'in_progress',
  'waiting_parts',
  'done',
  'ready_final_inspection',
  'good_to_go',
  'failed_inspection',
  'void',
])

// Mirrors src/types/workOrder.ts:2
export const WOPriorityEnum = z.enum(['low', 'normal', 'high', 'critical'])

const STR = z.string().max(5000)

// PATCH /api/work-orders/[id] — update body
// Required: expected_updated_at (route line 274 enforces).
// All other fields optional. Optional + nullable mirrors the route's
// `if (val === null) { update[f] = null; continue }` carve-out at line 219.
export const WorkOrderPatchSchema = z.object({
  expected_updated_at: z.string().min(1),
  status: WOStatusEnum.optional().nullable(),
  priority: WOPriorityEnum.optional().nullable(),
  team: STR.optional().nullable(),
  bay: STR.optional().nullable(),
  assigned_tech: z.string().uuid().optional().nullable(),
  complaint: STR.optional().nullable(),
  cause: STR.optional().nullable(),
  correction: STR.optional().nullable(),
  internal_notes: STR.optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  grand_total: numFinite.optional().nullable(),
  due_date: STR.optional().nullable(),
  service_writer_id: z.string().uuid().optional().nullable(),
  parts_person_id: z.string().uuid().optional().nullable(),
  customer_contact_name: STR.optional().nullable(),
  customer_contact_phone: STR.optional().nullable(),
  fleet_contact_name: STR.optional().nullable(),
  fleet_contact_phone: STR.optional().nullable(),
  po_number: STR.optional().nullable(),
  estimate_date: STR.optional().nullable(),
  promised_date: STR.optional().nullable(),
  estimate_approved: z.boolean().optional().nullable(),
  estimate_status: STR.optional().nullable(),
  approval_method: STR.optional().nullable(),
  estimate_declined_reason: STR.optional().nullable(),
  customer_estimate_notes: STR.optional().nullable(),
  submitted_at: STR.optional().nullable(),
}).strip()

export type WorkOrderPatchBody = z.infer<typeof WorkOrderPatchSchema>

export function workOrderBadInput(err: z.ZodError) {
  return NextResponse.json(
    {
      error: 'Invalid payload',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    },
    { status: 400 },
  )
}
