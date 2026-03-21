import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/services/email'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const body = await req.json()
  const { action, processed_by, notes } = body

  if (!action || !['process', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'action must be "process" or "deny"' }, { status: 400 })
  }

  const s = db()

  // Get the data request
  const { data: dr, error: drErr } = await s
    .from('data_requests')
    .select('*, customers(id, company_name, contact_name, email)')
    .eq('id', id)
    .single()

  if (drErr || !dr) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const customerEmail = dr.customers?.email
  const customerName = dr.customers?.company_name || dr.customers?.contact_name || 'Customer'

  if (action === 'deny') {
    await s.from('data_requests').update({
      status: 'denied',
      processed_by: processed_by || null,
      processed_at: new Date().toISOString(),
      notes: notes || null,
    }).eq('id', id)

    if (customerEmail) {
      await sendEmail(
        customerEmail,
        `Your Data Request Has Been Reviewed`,
        `<p>Hello ${customerName},</p>` +
        `<p>Your data ${dr.request_type} request has been denied.</p>` +
        (notes ? `<p>Reason: ${notes}</p>` : '') +
        `<p>If you have questions, please contact the shop directly.</p>`
      )
    }

    return NextResponse.json({ status: 'denied' })
  }

  // action === 'process'
  if (dr.request_type === 'deletion') {
    // Soft-delete customer and related records
    const now = new Date().toISOString()
    const customerId = dr.customer_id

    await s.from('customers').update({ deleted_at: now }).eq('id', customerId)
    await s.from('contacts').update({ deleted_at: now }).eq('customer_id', customerId)
    await s.from('assets').update({ deleted_at: now }).eq('customer_id', customerId)
    await s.from('service_orders').update({ deleted_at: now }).eq('customer_id', customerId)
    await s.from('invoices').update({ deleted_at: now }).eq('customer_id', customerId)
  }

  // For export: just mark as completed for now
  await s.from('data_requests').update({
    status: 'completed',
    processed_by: processed_by || null,
    processed_at: new Date().toISOString(),
    notes: notes || null,
  }).eq('id', id)

  if (customerEmail) {
    await sendEmail(
      customerEmail,
      `Your Data Request Has Been Processed`,
      `<p>Hello ${customerName},</p>` +
      `<p>Your data ${dr.request_type} request has been processed.</p>` +
      (dr.request_type === 'deletion'
        ? `<p>Your data has been removed from our system.</p>`
        : `<p>Your data export is ready.</p>`) +
      `<p>If you have questions, please contact the shop directly.</p>`
    )
  }

  return NextResponse.json({ status: 'completed' })
}
