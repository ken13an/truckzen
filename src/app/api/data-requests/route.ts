import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getStaffEmails } from '@/lib/services/email'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const shop_id = url.searchParams.get('shop_id')
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const s = db()
  const { data, error } = await s
    .from('data_requests')
    .select('*, customers(company_name, contact_name, email)')
    .eq('shop_id', shop_id)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const body = await req.json()
  const { shop_id, customer_id, request_type, reason } = body

  if (!shop_id || !customer_id || !request_type) {
    return NextResponse.json({ error: 'shop_id, customer_id, and request_type required' }, { status: 400 })
  }

  const s = db()

  const { data, error } = await s.from('data_requests').insert({
    shop_id,
    customer_id,
    request_type,
    reason: reason || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get customer name for email
  const { data: customer } = await s.from('customers').select('company_name, contact_name').eq('id', customer_id).single()
  const customerName = customer?.company_name || customer?.contact_name || 'A customer'

  // Email shop admins
  const adminEmails = await getStaffEmails(shop_id, 'owner')
  if (adminEmails.length > 0) {
    await sendEmail(
      adminEmails,
      `New Data ${request_type === 'deletion' ? 'Deletion' : 'Export'} Request`,
      `<p>${customerName} has submitted a data <strong>${request_type}</strong> request.</p>` +
      (reason ? `<p>Reason: ${reason}</p>` : '') +
      `<p>Please review this request in the TruckZen admin panel.</p>`
    )
  }

  return NextResponse.json(data, { status: 201 })
}
