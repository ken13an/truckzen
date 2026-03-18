// lib/integrations/stripe.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

export async function createCheckoutSession(invoiceId: string, amountCents: number, customerEmail: string | undefined, description: string, successUrl: string, cancelUrl: string) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: customerEmail,
    line_items: [{ price_data: { currency: 'usd', unit_amount: amountCents, product_data: { name: description } }, quantity: 1 }],
    metadata: { invoice_id: invoiceId },
    success_url: successUrl,
    cancel_url:  cancelUrl,
  })
}

export async function retrieveSession(sessionId: string) {
  return stripe.checkout.sessions.retrieve(sessionId)
}

export async function createRefund(paymentIntentId: string, amountCents?: number) {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountCents ? { amount: amountCents } : {}),
  })
}

export async function getBalance() {
  return stripe.balance.retrieve()
}

export async function listPayments(limit = 10) {
  return stripe.paymentIntents.list({ limit })
}

export async function constructWebhookEvent(body: string, signature: string) {
  return stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
}
