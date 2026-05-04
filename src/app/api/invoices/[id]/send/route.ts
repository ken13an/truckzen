// app/api/invoices/[id]/send/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthenticatedUserProfile, getActorShopId } from '@/lib/server-auth'
import { sendInvoiceEmail } from '@/lib/integrations/resend'
import { generateInvoicePdf } from '@/lib/pdf/generateInvoicePdf'
import { logAction } from '@/lib/services/auditLog'
import { safeRoute } from '@/lib/api-handler'
import { resolveInvoiceRecipientEmail } from '@/lib/notifications/resolveInvoiceRecipientEmail'

type P = { params: Promise<{ id: string }> }

async function _POST(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient()
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const { data: inv } = await supabase
    .from('invoices')
    .select(`*, service_orders(so_number, complaint, cause, correction, assets(unit_number,year,make,model,odometer), users!assigned_tech(full_name), so_lines(line_type, description, real_name, part_number, quantity, unit_price, total_price, parts_sell_price, billed_hours, estimated_hours, actual_hours, parts_status, related_labor_line_id)), customers(company_name,contact_name,email,phone), shops(name,dba,phone,email,address,payment_payee_name,payment_bank_name,payment_ach_account,payment_ach_routing,payment_wire_account,payment_wire_routing,payment_zelle_email_1,payment_zelle_email_2,payment_mail_payee,payment_mail_address,payment_mail_address_2,payment_mail_city,payment_mail_state,payment_mail_zip,payment_note)`)
    .eq('id', id).eq('shop_id', shopId).single()

  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // F-12 parity: block manual send on financially-unready invoices.
  const totalNum = typeof inv.total === 'number' ? inv.total : Number(inv.total)
  if (!Number.isFinite(totalNum) || totalNum <= 0) {
    return NextResponse.json({ error: `Invoice is not ready to send (total: ${inv.total})`, invoiceTotal: inv.total }, { status: 409 })
  }

  const so    = inv.service_orders as any
  const shop  = inv.shops as any
  const asset = so?.assets

  // Canonical outbound recipient resolution — single source of truth used by every
  // outbound invoice-email caller (accounting manual send + sendPaymentNotifications).
  const recipientEmail = await resolveInvoiceRecipientEmail(supabase, inv.so_id, (inv.customers as any)?.email)
  if (!recipientEmail) return NextResponse.json({ error: 'No email address found for owner/customer or kiosk contact' }, { status: 400 })

  // Generate invoice PDF — direct call, no HTTP.
  // PDF generation is part of the send contract: the email body claims an
  // attachment, so a missing PDF would deliver a misleading invoice. On
  // either failure mode (generator returns null, generator throws), block
  // the send with a 500 and leave the invoice's status untouched so the
  // operator can retry without manual cleanup.
  let pdfAttachments: { filename: string; content: Buffer }[]
  try {
    const pdfResult = await generateInvoicePdf(id)
    if (!pdfResult) {
      console.error('[invoice.send] PDF generator returned null — blocking send', { invoiceId: id })
      return NextResponse.json({ error: 'Failed to generate invoice PDF' }, { status: 500 })
    }
    pdfAttachments = [{ filename: pdfResult.filename, content: Buffer.from(pdfResult.pdfBytes) }]
  } catch (err: any) {
    console.error('[invoice.send] PDF generation failed — blocking send', { invoiceId: id, error: err?.message || String(err) })
    return NextResponse.json({ error: 'Failed to generate invoice PDF' }, { status: 500 })
  }

  const emailData = {
    shop:        { name: shop?.name, dba: shop?.dba, phone: shop?.phone, email: shop?.email, address: shop?.address, payment_payee_name: shop?.payment_payee_name, payment_bank_name: shop?.payment_bank_name, payment_ach_account: shop?.payment_ach_account, payment_ach_routing: shop?.payment_ach_routing, payment_wire_account: shop?.payment_wire_account, payment_wire_routing: shop?.payment_wire_routing, payment_zelle_email_1: shop?.payment_zelle_email_1, payment_zelle_email_2: shop?.payment_zelle_email_2, payment_mail_payee: shop?.payment_mail_payee, payment_mail_address: shop?.payment_mail_address, payment_mail_city: shop?.payment_mail_city, payment_mail_state: shop?.payment_mail_state, payment_mail_zip: shop?.payment_mail_zip },
    customer:    { company_name: (inv.customers as any)?.company_name, contact_name: (inv.customers as any)?.contact_name, email: recipientEmail },
    invoice:     { invoice_number: inv.invoice_number, due_date: inv.due_date, subtotal: inv.subtotal, tax_amount: inv.tax_amount, total: inv.total, amount_paid: inv.amount_paid, balance_due: inv.balance_due, notes: inv.notes },
    serviceOrder:{ so_number: so?.so_number, complaint: so?.complaint, cause: so?.cause, correction: so?.correction, truck_unit: asset?.unit_number, truck_make_model: `${asset?.year} ${asset?.make} ${asset?.model}`, technician_name: so?.users?.full_name, odometer_in: asset?.odometer },
    lines:       so?.so_lines || [],
    attachments: pdfAttachments,
  }

  const result = await sendInvoiceEmail(emailData)
  if (!result.success) {
    console.error('[invoice.send] Resend failed', { invoiceId: id, error: result.error })
    return NextResponse.json({ error: result.error || 'Email delivery failed' }, { status: 500 })
  }

  // Mark invoice as sent
  const now = new Date().toISOString()
  await supabase.from('invoices').update({ status: 'sent', sent_at: now }).eq('id', id)

  // Sync service_orders.invoice_status so accounting page sees the sent state
  if (inv.so_id) {
    await supabase.from('service_orders').update({ invoice_status: 'sent', updated_at: now }).eq('id', inv.so_id)
  }

  // Fire and forget
  logAction({ shop_id: shopId, user_id: actor.id, action: 'invoice.sent', entity_type: 'invoice', entity_id: id }).catch(() => {})

  return NextResponse.json({ success: true, messageId: result.id })
}

export const POST = safeRoute(_POST)
