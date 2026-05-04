// Request-body validation for /api/invoices write routes.
//
// Schemas mirror the routes' existing accept-set verbatim — they do not
// invent required fields, do not change response shape (validation failures
// return a structured 400 only), and do not redesign workflow. Enums are
// tightened to the unions already declared in src/types/invoice.ts:
//   InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void'
//   PaymentMethod = 'stripe' | 'cash' | 'check' | 'ach' | 'other'
// Number coercion mirrors src/app/api/estimates/[id]/route.ts:8 so a UI that
// posts numeric fields as strings keeps working unchanged.

import { NextResponse } from 'next/server'
import { z } from 'zod'

const numCoerce = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number(),
)

// Mirrors src/types/invoice.ts:1
export const InvoiceStatusEnum = z.enum([
  'draft',
  'sent',
  'viewed',
  'partial',
  'paid',
  'overdue',
  'void',
])

// Mirrors src/types/invoice.ts:2
export const PaymentMethodEnum = z.enum([
  'stripe',
  'cash',
  'check',
  'ach',
  'other',
])

// POST /api/invoices — create body
// Required: so_id (route line 105 enforces).
// Everything else optional; route applies defaults downstream.
export const InvoiceCreateSchema = z.object({
  so_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().nullable(),
  due_date: z.string().min(1).optional().nullable(),
  tax_rate: numCoerce.optional(),
  notes: z.string().max(5000).optional().nullable(),
}).strip()

// PATCH /api/invoices/[id] — update body
// Required: expected_updated_at (route line 74 enforces).
// Optional fields mirror the route's `updateable` allow-list at line 65.
// expected_updated_at uses a permissive datetime check so existing UI
// timestamps continue to validate. Server-owned totals (subtotal/tax_amount/
// total) remain accepted here per Patch 9 scope; the strip is Patch 12.
export const InvoicePatchSchema = z.object({
  expected_updated_at: z.string().min(1),
  status: InvoiceStatusEnum.optional(),
  due_date: z.string().min(1).optional().nullable(),
  tax_amount: numCoerce.optional().nullable(),
  subtotal: numCoerce.optional().nullable(),
  total: numCoerce.optional().nullable(),
  amount_paid: numCoerce.optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  payment_method: PaymentMethodEnum.optional().nullable(),
  paid_at: z.string().min(1).optional().nullable(),
}).strip()

export type InvoiceCreateBody = z.infer<typeof InvoiceCreateSchema>
export type InvoicePatchBody = z.infer<typeof InvoicePatchSchema>

export function invoiceBadInput(err: z.ZodError) {
  return NextResponse.json(
    {
      error: 'Invalid payload',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    },
    { status: 400 },
  )
}
