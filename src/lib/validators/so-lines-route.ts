// Request-body validation for /api/so-lines write routes.
//
// Scope today: POST /api/so-lines only. The PATCH /api/so-lines/[id] handler
// already enforces strict per-field validation inline (numeric Number.isFinite
// rejection, enum binding to VALID_LINE_STATUSES / VALID_PARTS_STATUSES /
// VALID_PARTS_REQUIREMENTS, non-string/boolean rejection, return_unused_qty
// guard with allowed-keys set, required expected_updated_at), so adding a
// schema over the top would be cosmetic. If a future patch consolidates the
// PATCH validator here, it would need to preserve those exact carve-outs
// (mechanic single-key, return_unused_qty branch, parts_requirement = null
// to clear).
//
// Schema mirrors the route's existing accept-set verbatim. Required fields
// match the route's truthiness check at src/app/api/so-lines/route.ts:68
// (so_id, line_type, description). Numeric fields use the same numCoerce
// preprocessor used by the invoices and estimates validators so a UI sending
// "1" for quantity keeps working. Enums bind to the canonical const arrays
// owned by src/lib/state/line-status.ts and src/lib/parts-status.ts.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { VALID_LINE_STATUSES } from '@/lib/state/line-status'
import { VALID_PARTS_STATUSES } from '@/lib/parts-status'

const numCoerce = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number(),
)

// Mirrors src/types/workOrder.ts:3 — LineType = 'labor' | 'job' | 'part' |
// 'shop_charge' | 'sublet'. Hardcoded here because there is no const-array
// export of LineType to import.
export const LineTypeEnum = z.enum(['labor', 'job', 'part', 'shop_charge', 'sublet'])

// POST /api/so-lines — create body
export const SoLineCreateSchema = z.object({
  so_id: z.string().uuid(),
  line_type: LineTypeEnum,
  description: z.string().min(1),
  part_number: z.string().optional().nullable(),
  quantity: numCoerce.optional(),
  unit_price: numCoerce.optional(),
  estimated_hours: numCoerce.optional().nullable(),
  line_status: z.enum(VALID_LINE_STATUSES).optional().nullable(),
  rough_name: z.string().optional().nullable(),
  parts_status: z.enum(VALID_PARTS_STATUSES).optional().nullable(),
  related_labor_line_id: z.string().uuid().optional().nullable(),
}).strip()

export type SoLineCreateBody = z.infer<typeof SoLineCreateSchema>

export function soLinesBadInput(err: z.ZodError) {
  return NextResponse.json(
    {
      error: 'Invalid payload',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    },
    { status: 400 },
  )
}
