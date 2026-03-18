import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY!)
export async function POST(req: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  try {
    const { token, session_id } = await req.json()
    if (!session_id) return NextResponse.json({ error: 'Missing session' }, { status: 400 })

    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not confirmed' }, { status: 400 })
    }

    const invoiceId = session.metadata?.invoice_id
    if (!invoiceId) return NextResponse.json({ error: 'Missing invoice ref' }, { status: 400 })

    const { data: inv } = await supabase
      .from('invoices')
      .select('invoice_number, shops(name, dba, phone)')
      .eq('id', invoiceId)
      .single()

    const shop = (inv as any)?.shops
    return NextResponse.json({
      invoice_num:  (inv as any)?.invoice_number,
      amount_paid:  (session.amount_total ?? 0) / 100,
      shop_name:    shop?.dba || shop?.name,
      shop_phone:   shop?.phone,
    })
  } catch {
    return NextResponse.json({ error: 'Confirmation failed' }, { status: 500 })
  }
}
