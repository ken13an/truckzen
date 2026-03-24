import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wo_id } = await req.json()
  if (!wo_id) return NextResponse.json({ error: 'wo_id required' }, { status: 400 })

  const s = db()

  // Check if already sent
  const { data: existing } = await s.from('notifications')
    .select('id')
    .eq('link', `/work-orders/${wo_id}`)
    .eq('type', 'customer_ready')
    .limit(1)
  if (existing && existing.length > 0) return NextResponse.json({ already_sent: true })

  // Get WO with customer and asset
  const { data: wo } = await s.from('service_orders')
    .select('id, so_number, grand_total, customer_id, asset_id, shop_id, customers(company_name, contact_name, phone, email, sms_opted_out, email_opted_out), assets(unit_number, year, make, model)')
    .eq('id', wo_id)
    .single()

  if (!wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

  const customer = wo.customers as any
  const asset = wo.assets as any
  if (!customer) return NextResponse.json({ error: 'No customer on this WO' }, { status: 400 })

  // Get shop info
  const { data: shop } = await s.from('shops').select('name, phone, address').eq('id', wo.shop_id).single()

  const unitDesc = [asset?.unit_number, asset?.year, asset?.make, asset?.model].filter(Boolean).join(' ')
  const results: { sms?: string; email?: string } = {}

  // Send SMS via Twilio
  if (customer.phone && !customer.sms_opted_out) {
    try {
      const { sendSMS } = await import('@/lib/integrations/twilio')
      const smsBody = `Your truck ${asset?.unit_number || ''} is ready for pickup at ${shop?.name || 'the shop'}. WO #${wo.so_number}. Call us: ${shop?.phone || ''}. Reply STOP to unsubscribe.`
      await sendSMS(customer.phone, smsBody.slice(0, 160))
      results.sms = 'sent'
    } catch (e: any) {
      results.sms = `failed: ${e.message}`
    }
  }

  // Send email via Resend
  if (customer.email && !customer.email_opted_out) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@truckzen.pro'

      await resend.emails.send({
        from: `${shop?.name || 'TruckZen'} <${fromEmail}>`,
        to: customer.email,
        subject: `Your truck is ready — WO #${wo.so_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1A1A1A; margin-bottom: 16px;">Your vehicle is ready for pickup</h2>
            <p>Hi ${customer.contact_name || customer.company_name || 'Customer'},</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px 0; color: #6B7280;">Vehicle</td><td style="padding: 8px 0; font-weight: 600;">${unitDesc}</td></tr>
              <tr><td style="padding: 8px 0; color: #6B7280;">Work Order</td><td style="padding: 8px 0; font-weight: 600;">#${wo.so_number}</td></tr>
              ${wo.grand_total ? `<tr><td style="padding: 8px 0; color: #6B7280;">Total</td><td style="padding: 8px 0; font-weight: 600;">$${Number(wo.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ''}
            </table>
            <p>Please pick up your vehicle at:</p>
            <p style="font-weight: 600;">${shop?.name || ''}<br/>${shop?.address || ''}<br/>${shop?.phone || ''}</p>
            <p style="color: #6B7280; margin-top: 24px;">Thank you for your business.</p>
          </div>
        `,
      })
      results.email = 'sent'
    } catch (e: any) {
      results.email = `failed: ${e.message}`
    }
  }

  // Log notification
  await s.from('notifications').insert({
    shop_id: wo.shop_id,
    user_id: user.id,
    type: 'customer_ready',
    title: `Ready notification sent for WO #${wo.so_number}`,
    body: `SMS: ${results.sms || 'skipped'}, Email: ${results.email || 'skipped'}`,
    link: `/work-orders/${wo_id}`,
  })

  return NextResponse.json({ ok: true, ...results })
}
