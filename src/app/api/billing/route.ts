import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

// GET /api/billing?shop_id=...
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data: shop } = await s.from('shops').select('id, name, dba, stripe_customer_id, subscription_status, subscription_plan').eq('id', shopId).single()
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  let paymentMethods: any[] = []
  if (shop.stripe_customer_id) {
    try {
      const stripe = getStripe()
      const methods = await stripe.paymentMethods.list({ customer: shop.stripe_customer_id, type: 'card' })
      paymentMethods = methods.data.map(m => ({
        id: m.id,
        brand: m.card?.brand,
        last4: m.card?.last4,
        exp_month: m.card?.exp_month,
        exp_year: m.card?.exp_year,
      }))
    } catch {}
  }

  return NextResponse.json({
    shop_id: shop.id,
    shop_name: shop.dba || shop.name,
    stripe_customer_id: shop.stripe_customer_id,
    subscription_status: shop.subscription_status || 'free',
    subscription_plan: shop.subscription_plan || 'free',
    payment_methods: paymentMethods,
  })
}

// POST /api/billing
export async function POST(req: Request) {
  const s = db()
  const stripe = getStripe()
  const body = await req.json()
  const { action, shop_id } = body

  if (!shop_id || !action) return NextResponse.json({ error: 'shop_id and action required' }, { status: 400 })

  const { data: shop } = await s.from('shops').select('id, name, dba, email, stripe_customer_id').eq('id', shop_id).single()
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  switch (action) {
    case 'create_setup_session': {
      // Create Stripe customer if needed
      let customerId = shop.stripe_customer_id
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: shop.dba || shop.name,
          email: shop.email || undefined,
          metadata: { shop_id: shop.id },
        })
        customerId = customer.id
        await s.from('shops').update({ stripe_customer_id: customerId }).eq('id', shop.id)
      }

      // Create setup session for adding payment method
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?setup=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?setup=cancel`,
        metadata: { shop_id: shop.id },
      })

      return NextResponse.json({ url: session.url })
    }

    case 'remove_payment_method': {
      const { payment_method_id } = body
      if (!payment_method_id) return NextResponse.json({ error: 'payment_method_id required' }, { status: 400 })
      await stripe.paymentMethods.detach(payment_method_id)
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
