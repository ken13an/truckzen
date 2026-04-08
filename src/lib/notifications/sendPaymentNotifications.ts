import { createClient } from '@supabase/supabase-js'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { truckReadyEmail } from '@/lib/emails/truckReady'
import { generateInvoicePdf } from '@/lib/pdf/generateInvoicePdf'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function sendPaymentNotifications(woId: string, shopId: string) {
  const s = db()

  // Get WO with customer and asset info
  const { data: wo } = await s.from('service_orders')
    .select('id, so_number, customer_id, asset_id, customers(company_name, email, phone, contact_name), assets(unit_number, year, make, model)')
    .eq('id', woId).single()
  if (!wo) return

  // Get contact info — kiosk checkin first, then customer record
  const { data: checkin } = await s.from('kiosk_checkins')
    .select('contact_email, contact_phone')
    .eq('wo_id', woId).order('created_at', { ascending: false }).limit(1).single()

  const email = checkin?.contact_email || (wo.customers as any)?.email
  const phone = checkin?.contact_phone || (wo.customers as any)?.phone
  const customerName = (wo.customers as any)?.contact_name || (wo.customers as any)?.company_name || 'Customer'
  const asset = wo.assets as any
  const unitNumber = asset?.unit_number || ''
  const truckInfo = [asset?.year, asset?.make, asset?.model].filter(Boolean).join(' ')

  // Get or create invoice
  let invoiceId: string | null = null
  let invoiceNumber = ''
  let totalAmount = 0
  const { data: inv } = await s.from('invoices').select('id, invoice_number, total').eq('so_id', woId).limit(1).single()
  if (inv) { invoiceId = inv.id; invoiceNumber = inv.invoice_number; totalAmount = inv.total }

  const shop = await getShopInfo(shopId)

  // Send email + SMS in parallel
  const promises: Promise<void>[] = []

  // Email with invoice + PDF attachment
  if (email) {
    promises.push((async () => {
      try {
        const { subject, html } = truckReadyEmail({
          customerName,
          unitNumber,
          invoiceNumber: invoiceNumber || wo.so_number,
          amount: totalAmount.toFixed(2),
          shop: { name: shop.name, phone: shop.phone },
        })

        // Generate invoice PDF for attachment — direct call, no HTTP
        let attachments: { filename: string; content: Buffer }[] | undefined
        if (invoiceId) {
          try {
            const pdfResult = await generateInvoicePdf(invoiceId)
            if (pdfResult) {
              attachments = [{ filename: pdfResult.filename, content: Buffer.from(pdfResult.pdfBytes) }]
            }
          } catch { /* PDF attachment non-critical */ }
        }

        await sendEmail(email, subject, html, attachments)
        await logNotification(s, shopId, woId, 'email', null, email, 'sent')
      } catch (err: any) {
        await logNotification(s, shopId, woId, 'email', null, email, 'failed', err.message)
      }
    })())
  }

  // SMS via Twilio
  if (phone) {
    promises.push((async () => {
      try {
        const twilio = (await import('twilio')).default
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
        const smsBody = `${shop.name}: Your truck Unit #${unitNumber} service is complete. Invoice ${invoiceNumber}: $${totalAmount.toFixed(2)}. Pay by Zelle, cash, check, or card. Call us: ${shop.phone}`
        await client.messages.create({
          body: smsBody,
          to: phone,
          from: process.env.TWILIO_PHONE_NUMBER!,
        })
        await logNotification(s, shopId, woId, 'sms', phone, null, 'sent')
      } catch (err: any) {
        console.error('[SMS] Failed:', err.message)
        await logNotification(s, shopId, woId, 'sms', phone, null, 'failed', err.message)
      }
    })())
  }

  if (!email && !phone) {
    console.warn(`[Notification] No contact info for WO ${wo.so_number}`)
  }

  await Promise.all(promises)
}

async function logNotification(s: any, shopId: string, woId: string, type: string, phone: string | null, email: string | null, status: string, error?: string) {
  await s.from('notification_log').insert({
    shop_id: shopId,
    wo_id: woId,
    notification_type: type,
    recipient_phone: phone,
    recipient_email: email,
    status,
    error_message: error || null,
  }).then(() => {})
}
