// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
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

      // TODO: trigger QuickBooks sync
      // TODO: trigger Twilio SMS receipt to customer
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

// Stripe requires raw body — disable Next.js body parsing
