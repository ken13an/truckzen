import { ACCOUNTING_ROLES } from '@/lib/roles'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId } from '@/lib/server-auth'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }


// GET — list payments for an invoice
export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get('invoice_id')
  if (!invoiceId) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 })

  const s = db()
  const { data, error } = await s
    .from('invoice_payments')
    .select('*, users:recorded_by(full_name)')
    .eq('invoice_id', invoiceId)
    .eq('shop_id', shopId)
    .order('received_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST — record a payment
export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })
  const effectiveRole = actor.impersonate_role || actor.role
  if (!ACCOUNTING_ROLES.includes(effectiveRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { invoice_id, payment_method, amount, reference_number, received_at, notes } = body
  if (!invoice_id || !payment_method || !amount) return NextResponse.json({ error: 'invoice_id, payment_method, and amount required' }, { status: 400 })

  const s = db()

  // Record payment
  const { data: payment, error } = await s.from('invoice_payments').insert({
    invoice_id,
    shop_id: shopId,
    payment_method,
    amount: parseFloat(amount),
    reference_number: reference_number || null,
    received_at: received_at || new Date().toISOString(),
    notes: notes || null,
    recorded_by: actor.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get invoice and total payments
  const { data: invoice } = await s.from('invoices').select('total, amount_paid').eq('id', invoice_id).single()
  const { data: allPayments } = await s.from('invoice_payments').select('amount').eq('invoice_id', invoice_id)

  const totalPaid = (allPayments || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
  const invoiceTotal = invoice?.total || 0
  const newStatus = totalPaid >= invoiceTotal ? 'paid' : 'partial'
  const balanceDue = Math.max(0, invoiceTotal - totalPaid)

  await s.from('invoices').update({
    status: newStatus,
    amount_paid: totalPaid,
    balance_due: balanceDue,
    payment_method,
    paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', invoice_id)

  return NextResponse.json({ payment, status: newStatus, total_paid: totalPaid, balance_due: balanceDue }, { status: 201 })
}
