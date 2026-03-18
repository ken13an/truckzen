const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.vercel.app'
export async function generatePaymentQR(invoiceId: string) {
  const paymentUrl = `${APP_URL}/pay/${Buffer.from(invoiceId).toString('base64')}`
  return { token: invoiceId, paymentUrl }
}
export function verifyPaymentToken(token: string) {
  try { return { invoiceId: Buffer.from(token, 'base64').toString() } } catch { return null }
}
export async function createStripeCheckout(invoiceId: string, amount: number = 0, customerId: string = "") {
  const Stripe = require('stripe')
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Invoice Payment' }, unit_amount: Math.round((amount||100)*100) }, quantity: 1 }],
    mode: 'payment',
    success_url: `${APP_URL}/pay/${invoiceId}/success`,
    cancel_url: `${APP_URL}/pay/${invoiceId}`,
    metadata: { invoiceId },
  })
  return { url: session.url, sessionId: session.id }
}
