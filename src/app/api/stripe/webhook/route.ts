// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server'
import { safeRoute } from '@/lib/api-handler'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getStaffEmails, getShopInfo } from '@/lib/services/email'
import { paymentReceivedEmail } from '@/lib/emails/paymentReceived'
import { staffPaymentReceivedEmail } from '@/lib/emails/staffPaymentReceived'
import { sendPushToRole } from '@/lib/services/notifications'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function _POST(req: Request) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Stripe webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session    = event.data.object as Stripe.Checkout.Session
      const invoiceId  = session.metadata?.invoice_id
      const shopId     = session.metadata?.shop_id
      const payToken   = session.metadata?.payment_token
      if (!invoiceId || !shopId) break

      const amountPaid = (session.amount_total ?? 0) / 100

      // Mark invoice paid
      await getSupabase().from('invoices').update({
        status:                 'paid',
        amount_paid:            amountPaid,
        payment_method:         'card',
        stripe_payment_intent:  session.payment_intent as string,
        paid_at:                new Date().toISOString(),
      }).eq('id', invoiceId)

      // Mark payment token used
      if (payToken) {
        await getSupabase().from('payment_tokens')
          .update({ used: true, used_at: new Date().toISOString() })
          .eq('invoice_id', invoiceId)
      }

      // Audit log
      await getSupabase().from('audit_log').insert({
        shop_id:    shopId,
        user_id:    null,
        action:     'invoice.paid',
        table_name: 'invoices',
        record_id:  invoiceId,
        new_data:   { amount_paid: amountPaid, method: 'stripe_qr', session_id: session.id },
      })

      // Fire-and-forget email notifications
      ;(async () => {
        try {
          const sup = getSupabase()
          const { data: invoice } = await sup.from('invoices')
            .select('id, invoice_number, wo_id, total')
            .eq('id', invoiceId).single()
          if (!invoice) return

          const { data: wo } = await sup.from('service_orders')
            .select('id, customer_id, so_number')
            .eq('id', invoice.wo_id).single()
          if (!wo) return

          const { data: customer } = await sup.from('customers')
            .select('email, contact_name, company_name')
            .eq('id', wo.customer_id).single()

          const shop = await getShopInfo(shopId)
          const customerName = customer?.contact_name || customer?.company_name || 'Customer'
          const amount = String(amountPaid)

          // 1. Payment receipt to customer
          if (customer?.email) {
            const { subject, html } = paymentReceivedEmail({
              customerName,
              invoiceNumber: invoice.invoice_number,
              amount,
              shop,
            })
            await sendEmail(customer.email, subject, html)
          }

          // 2. Staff notification to accounting
          const accountingEmails = await getStaffEmails(shopId, 'accountant')
          if (accountingEmails.length > 0) {
            const { subject, html } = staffPaymentReceivedEmail({
              customerName,
              invoiceNumber: invoice.invoice_number,
              amount,
              method: 'Stripe',
              shop,
            })
            await sendEmail(accountingEmails, subject, html)
          }

          // 3. Push to accountant role
          await sendPushToRole(shopId, 'accountant', 'Payment Received', `$${amount} for ${invoice.invoice_number}`)
        } catch {}
      })()

      // TODO: trigger QuickBooks sync
      break
    }

    case 'payment_intent.payment_failed': {
      const pi         = event.data.object as Stripe.PaymentIntent
      const invoiceId  = pi.metadata?.invoice_id
      const shopId     = pi.metadata?.shop_id
      if (!invoiceId || !shopId) break

      await getSupabase().from('audit_log').insert({
        shop_id:    shopId,
        user_id:    null,
        action:     'invoice.payment_failed',
        table_name: 'invoices',
        record_id:  invoiceId,
        new_data:   { error: pi.last_payment_error?.message },
      })
      break
    }

    default:
      // Ignore unhandled events
      break
  }

  return NextResponse.json({ received: true })
}

export const POST = safeRoute(_POST)

// Stripe requires raw body — disable Next.js body parsing
