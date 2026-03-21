import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

export async function POST(req: Request, { params }: P) {
  const { token } = await params
  const s = db()

  const { data: wo } = await s.from('service_orders').select('id, so_number, shop_id, customer_id').eq('portal_token', token).single()
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  await s.from('service_orders').update({
    estimate_status: 'approved',
    estimate_approved_date: now,
    approved_at: now,
    approved_by: 'customer_portal',
  }).eq('id', wo.id)

  // Approve all pending lines
  await s.from('so_lines').update({ customer_approved: true, approved_at: now }).eq('so_id', wo.id).is('customer_approved', null)

  // Log activity
  await s.from('wo_activity_log').insert({ wo_id: wo.id, action: 'Customer approved estimate via portal' })

  // Send email notification to shop
  try {
    const { data: shop } = await s.from('shops').select('name, dba, email').eq('id', wo.shop_id).single()
    const { data: customer } = await s.from('customers').select('company_name').eq('id', wo.customer_id).single()
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY!)
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'TruckZen <noreply@truckzen.pro>',
      to: shop?.email || 'kenanagasiyev@gmail.com',
      subject: `Estimate Approved — ${wo.so_number}`,
      html: `<div style="font-family:sans-serif;padding:24px">
        <h2 style="color:#16A34A">Estimate Approved</h2>
        <p><strong>${customer?.company_name || 'Customer'}</strong> approved the estimate for <strong>${wo.so_number}</strong>.</p>
        <p>You can proceed with the authorized repairs.</p>
        <a href="https://truckzen.pro/work-orders/${wo.id}" style="display:inline-block;padding:12px 24px;background:#1D6FE8;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">View Work Order</a>
      </div>`,
    })
  } catch {}

  return NextResponse.json({ ok: true })
}
