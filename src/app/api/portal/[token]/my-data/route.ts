import { NextResponse } from 'next/server'
import { checkPortalLimits } from '@/lib/ratelimit/portal-guard'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getStaffEmails } from '@/lib/services/email'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type P = { params: Promise<{ token: string }> }

async function resolveToken(token: string) {
  const s = db()
  const { data } = await s
    .from('service_orders')
    .select('shop_id, customer_id')
    .eq('portal_token', token)
    .single()
  return data
}

export async function GET(req: Request, { params }: P) {
  const { token } = await params
  const _rl = await checkPortalLimits(req, token); if (_rl !== true) return _rl
  const ctx = await resolveToken(token)
  if (!ctx) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const s = db()
  const { customer_id, shop_id } = ctx

  // Fetch all customer data in parallel
  const [customerRes, contactsRes, unitsRes, ordersRes, invoicesRes] = await Promise.all([
    s.from('customers').select('*').eq('id', customer_id).single(),
    s.from('contacts').select('*').eq('customer_id', customer_id).is('deleted_at', null),
    s.from('assets').select('*').eq('customer_id', customer_id).is('deleted_at', null),
    s.from('service_orders').select('*, so_lines(*)').eq('customer_id', customer_id).eq('shop_id', shop_id).is('deleted_at', null).order('created_at', { ascending: false }),
    s.from('invoices').select('*').eq('customer_id', customer_id).eq('shop_id', shop_id).is('deleted_at', null).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    customer: customerRes.data,
    contacts: contactsRes.data || [],
    units: unitsRes.data || [],
    service_orders: ordersRes.data || [],
    invoices: invoicesRes.data || [],
  })
}

export async function POST(req: Request, { params }: P) {
  const { token } = await params
  const _rl = await checkPortalLimits(req, token); if (_rl !== true) return _rl
  const ctx = await resolveToken(token)
  if (!ctx) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const body = await req.json()
  const { request_type, reason } = body

  if (!request_type || !['deletion', 'export'].includes(request_type)) {
    return NextResponse.json({ error: 'request_type must be "deletion" or "export"' }, { status: 400 })
  }

  const s = db()
  const { customer_id, shop_id } = ctx

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
      `<p>${customerName} has submitted a data <strong>${request_type}</strong> request via the customer portal.</p>` +
      (reason ? `<p>Reason: ${reason}</p>` : '') +
      `<p>Please review this request in the TruckZen admin panel.</p>`
    )
  }

  return NextResponse.json(data, { status: 201 })
}
