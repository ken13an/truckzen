import { ACCOUNTING_ROLES } from '@/lib/roles'
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}


export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ACCOUNTING_ROLES.includes(actor.role) && !actor.is_platform_owner) return jsonError('Forbidden', 403)

  const s = createAdminSupabaseClient()
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

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ACCOUNTING_ROLES.includes(actor.role) && !actor.is_platform_owner) return jsonError('Forbidden', 403)

  const s = createAdminSupabaseClient()
  const stripe = getStripe()
  const body = await req.json()
  const { action } = body

  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  const { data: shop } = await s.from('shops').select('id, name, dba, email, stripe_customer_id').eq('id', shopId).single()
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  switch (action) {
    case 'create_setup_session': {
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
