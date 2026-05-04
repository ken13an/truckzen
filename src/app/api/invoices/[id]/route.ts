import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthenticatedUserProfile, getActorShopId } from '@/lib/server-auth'
import { log } from '@/lib/security'
import { safeRoute } from '@/lib/api-handler'
import { InvoicePatchSchema, invoiceBadInput } from '@/lib/validators/invoice-route'

// Route-local direct-PATCH lock rule (Security_P1_Patch1_InvoiceHardLock_2).
// TruckZen accounting workflow allows correction-after-send while the invoice
// is still unpaid, so this route must NOT use the canonical isInvoiceHardLocked
// helper (which also locks 'sent'). 'sent' stays editable here. The canonical
// helper is preserved as-is for other routes (so-lines PATCH/DELETE, merge,
// work-orders/[id]/invoice) that legitimately treat 'sent' as locked.
const DIRECT_PATCH_LOCKED_STATUSES = ['paid', 'closed']

type P = { params: Promise<{ id: string }> }

async function _GET(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient()
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const { data, error } = await supabase
    .from('invoices')
    .select(`*, service_orders(id, so_number, status, complaint, cause, correction, assets(unit_number,year,make,model,odometer), users!assigned_tech(full_name), so_lines(*)), customers(*)`)
    .eq('id', id)
    .eq('shop_id', shopId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

async function _PATCH(req: Request, { params }: P) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient()
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const allowed = ['owner','gm','it_person','shop_manager','accountant','office_admin']
  const effectiveRole = actor.impersonate_role || actor.role
  if (!allowed.includes(effectiveRole)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const raw = await req.json().catch(() => null)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = InvoicePatchSchema.safeParse(raw)
  if (!parsed.success) return invoiceBadInput(parsed.error)
  const body = parsed.data
  const { data: current } = await supabase.from('invoices').select('*').eq('id', id).eq('shop_id', shopId).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (current.is_historical) {
    return NextResponse.json({ error: 'Historical Fullbay records are read-only' }, { status: 403 })
  }

  // Direct-PATCH lock gate (Security_P1_Patch1_InvoiceHardLock_2 / F-07 corrected).
  // Blocks 'paid' and 'closed' only. 'sent' stays editable here because
  // TruckZen accounting is expected to correct invoices after they've been
  // sent but before the customer has paid. Payment marking goes through
  // /api/invoice-payments; reopen through /api/work-orders/[id]/invoice.
  if (current.status && DIRECT_PATCH_LOCKED_STATUSES.includes(current.status)) {
    return NextResponse.json({ error: `Invoice is locked — ${current.status} invoices cannot be edited directly` }, { status: 403 })
  }

  // Server-owned totals (subtotal / tax_amount / total) are intentionally
  // absent — they are stamped at approval time via calcWoOperationalTotals
  // and must never be set directly from a PATCH body. The schema strips
  // them upstream; this allow-list mirrors that contract.
  const updateable = ['status','due_date','amount_paid','notes','payment_method','paid_at'] as const
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }
  // Bump updated_at so optimistic-concurrency precondition works on this route.
  update.updated_at = new Date().toISOString()

  // Optimistic concurrency: when client provides last-seen updated_at,
  // require match before writing. Schema enforces presence (min(1)) above;
  // this read is for the actual eq() filter on the update query.
  const expectedUpdatedAt = body.expected_updated_at
  let invQ = supabase.from('invoices').update(update).eq('id', id).eq('shop_id', shopId)
  if (expectedUpdatedAt) invQ = invQ.eq('updated_at', expectedUpdatedAt)
  const { data, error } = await invQ.select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json({ error: 'Conflict', message: 'This record was updated by someone else. Refresh and try again.' }, { status: 409 })
  }

  if (update.status && update.status !== current.status) {
    await log('invoice.sent' as any, shopId, actor.id, { table:'invoices', recordId:id, newData:{ status: update.status } })
  }
  return NextResponse.json(data)
}

export const GET = safeRoute(_GET)
export const PATCH = safeRoute(_PATCH)
