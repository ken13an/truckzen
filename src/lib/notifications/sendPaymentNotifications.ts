import { createClient } from '@supabase/supabase-js'
import { getShopInfo } from '@/lib/services/email'
import { sendInvoiceEmail } from '@/lib/integrations/resend'
import { generateInvoicePdf } from '@/lib/pdf/generateInvoicePdf'
import { resolveInvoiceRecipientEmail } from '@/lib/notifications/resolveInvoiceRecipientEmail'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function sendPaymentNotifications(woId: string, shopId: string): Promise<{ sent: boolean; emailOk: boolean; emailError?: string; skipped?: boolean; reason?: string }> {
  const s = db()

  // Get WO with customer and asset info
  const { data: wo } = await s.from('service_orders')
    .select('id, so_number, customer_id, asset_id, customers(company_name, email, phone, contact_name), assets(unit_number, year, make, model)')
    .eq('id', woId).single()
  if (!wo) return { sent: false, emailOk: false, emailError: 'Work order not found', skipped: true, reason: 'wo_missing' }

  // Contact resolution — email goes through canonical resolveInvoiceRecipientEmail so
  // this auto-notify path and the accounting manual-send path cannot drift apart.
  // Phone still prefers kiosk checkin then customer (no separate canonical path yet).
  const email = await resolveInvoiceRecipientEmail(s as any, woId, (wo.customers as any)?.email)
  const { data: checkin } = await s.from('kiosk_checkins')
    .select('contact_phone')
    .eq('wo_id', woId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const phone = checkin?.contact_phone || (wo.customers as any)?.phone
  const customerName = (wo.customers as any)?.contact_name || (wo.customers as any)?.company_name || 'Customer'
  const asset = wo.assets as any
  const unitNumber = asset?.unit_number || ''
  const truckInfo = [asset?.year, asset?.make, asset?.model].filter(Boolean).join(' ')

  // Get invoice and gate on financial readiness.
  const { data: inv } = await s.from('invoices').select('id, invoice_number, total').eq('so_id', woId).limit(1).single()
  if (!inv) {
    console.warn(`[Notification] Skipped WO ${wo.so_number}: invoice not found`)
    await logNotification(s, shopId, woId, 'email', null, email || null, 'skipped', 'Invoice not found')
    return { sent: false, emailOk: false, emailError: 'Invoice not found', skipped: true, reason: 'invoice_missing' }
  }
  const totalNum = typeof inv.total === 'number' ? inv.total : Number(inv.total)
  if (!Number.isFinite(totalNum) || totalNum <= 0) {
    console.warn(`[Notification] Skipped WO ${wo.so_number}: invalid invoice total (${inv.total})`)
    await logNotification(s, shopId, woId, 'email', null, email || null, 'skipped', `Invalid invoice total: ${inv.total}`)
    return { sent: false, emailOk: false, emailError: `Invalid invoice total: ${inv.total}`, skipped: true, reason: 'invoice_not_ready' }
  }
  const invoiceId: string = inv.id
  const invoiceNumber: string = inv.invoice_number
  const totalAmount: number = totalNum

  const shop = await getShopInfo(shopId)

  // Email (awaited so failure can be surfaced) + SMS (still parallel, non-critical).
  let emailOk = !email // if no email recipient, treat as trivially ok (nothing to send)
  let emailError: string | undefined = email ? undefined : 'no email recipient'

  const smsPromises: Promise<void>[] = []

  // Email with full invoice detail + PDF attachment
  if (email) {
    try {
      // Fetch full invoice data for the detailed email template
      const { data: fullInv } = await s.from('invoices')
        .select('*, service_orders(so_number, complaint, cause, correction, assets(unit_number,year,make,model,odometer), users!assigned_tech(full_name), so_lines(line_type, description, real_name, part_number, quantity, unit_price, total_price, parts_sell_price, billed_hours, estimated_hours, actual_hours, parts_status, related_labor_line_id)), shops(name,dba,phone,email,address,payment_payee_name,payment_bank_name,payment_ach_account,payment_ach_routing,payment_wire_account,payment_wire_routing,payment_zelle_email_1,payment_zelle_email_2,payment_mail_payee,payment_mail_address,payment_mail_address_2,payment_mail_city,payment_mail_state,payment_mail_zip,payment_note)')
        .eq('id', invoiceId).single()

      if (!fullInv) {
        emailError = 'Invoice not found for email'
        console.error('[sendPaymentNotifications] Invoice not found for email', { woId, invoiceId })
        await logNotification(s, shopId, woId, 'email', null, email, 'failed', emailError)
      } else {
        const so = fullInv.service_orders as any
        const shopData = fullInv.shops as any

        // Generate PDF attachment — failure is logged but does not block the
        // email. Customer still receives the invoice; server log captures the
        // missing attachment for follow-up.
        let pdfAttachments: { filename: string; content: Buffer }[] | undefined
        try {
          const pdfResult = await generateInvoicePdf(invoiceId)
          if (!pdfResult) {
            console.error('[sendPaymentNotifications] PDF generator returned null — sending email without attachment', { invoiceId })
          } else {
            pdfAttachments = [{ filename: pdfResult.filename, content: Buffer.from(pdfResult.pdfBytes) }]
          }
        } catch (pdfErr: any) {
          console.error('[sendPaymentNotifications] PDF generation failed — sending email without attachment', { invoiceId, error: pdfErr?.message || String(pdfErr) })
        }

        const result = await sendInvoiceEmail({
          shop: { name: shopData?.name, dba: shopData?.dba, phone: shopData?.phone, email: shopData?.email, address: shopData?.address, payment_payee_name: shopData?.payment_payee_name, payment_bank_name: shopData?.payment_bank_name, payment_ach_account: shopData?.payment_ach_account, payment_ach_routing: shopData?.payment_ach_routing, payment_wire_account: shopData?.payment_wire_account, payment_wire_routing: shopData?.payment_wire_routing, payment_zelle_email_1: shopData?.payment_zelle_email_1, payment_zelle_email_2: shopData?.payment_zelle_email_2, payment_mail_payee: shopData?.payment_mail_payee, payment_mail_address: shopData?.payment_mail_address, payment_mail_city: shopData?.payment_mail_city, payment_mail_state: shopData?.payment_mail_state, payment_mail_zip: shopData?.payment_mail_zip },
          customer: { company_name: customerName, contact_name: customerName, email },
          invoice: { invoice_number: fullInv.invoice_number, due_date: fullInv.due_date, subtotal: fullInv.subtotal, tax_amount: fullInv.tax_amount, total: fullInv.total, amount_paid: fullInv.amount_paid, balance_due: fullInv.balance_due, notes: fullInv.notes },
          serviceOrder: { so_number: so?.so_number, complaint: so?.complaint, cause: so?.cause, correction: so?.correction, truck_unit: (so?.assets as any)?.unit_number, truck_make_model: `${(so?.assets as any)?.year || ''} ${(so?.assets as any)?.make || ''} ${(so?.assets as any)?.model || ''}`.trim(), technician_name: (so?.users as any)?.full_name, odometer_in: (so?.assets as any)?.odometer },
          lines: so?.so_lines || [],
          attachments: pdfAttachments,
        })

        if (result.success) {
          emailOk = true
          await logNotification(s, shopId, woId, 'email', null, email, 'sent')
        } else {
          emailError = result.error || 'Resend returned failure'
          console.error('[sendPaymentNotifications] Resend failed', { invoiceId, email, error: emailError })
          await logNotification(s, shopId, woId, 'email', null, email, 'failed', emailError)
        }
      }
    } catch (err: any) {
      emailError = err?.message || String(err)
      console.error('[sendPaymentNotifications] Email path threw', { invoiceId, email, error: emailError })
      await logNotification(s, shopId, woId, 'email', null, email, 'failed', emailError)
    }
  }

  // SMS via Twilio
  if (phone) {
    smsPromises.push((async () => {
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

  await Promise.all(smsPromises)
  return { sent: emailOk, emailOk, emailError }
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
