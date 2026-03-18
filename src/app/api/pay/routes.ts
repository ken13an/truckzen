// ============================================================
// TRUCKZEN — PAYMENT API ROUTES
// Place each block in the corresponding file path shown above it
// ============================================================

// ── app/api/pay/verify/route.ts ──────────────────────────────
// POST /api/pay/verify — validates QR token, returns invoice data
export const verifyRoute = `
import { NextResponse } from 'next/server'
import { verifyPaymentToken } from '@/lib/payments/qr'
import { checkRateLimit } from '@/lib/security'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'

  // Rate limit — 10 verifications per minute per IP (prevents brute-force)
  const limit = await checkRateLimit('api', \`pay-verify:\${ip}\`)
  if (!limit.allowed) {
    return NextResponse.json(
      { valid: false, error: 'Too many requests' },
      { status: 429 }
    )
  }

  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string' || token.length > 500) {
      return NextResponse.json({ valid: false, error: 'Invalid token' })
    }

    const result = await verifyPaymentToken(token)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ valid: false, error: 'Verification failed' })
  }
}
`

// ── app/api/pay/checkout/route.ts ────────────────────────────
// POST /api/pay/checkout — creates Stripe checkout session
export const checkoutRoute = `
import { NextResponse } from 'next/server'
import { createStripeCheckout } from '@/lib/payments/qr'
import { checkRateLimit } from '@/lib/security'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'

  // Strict rate limit on checkout — 5 per minute per IP
  const limit = await checkRateLimit('api', \`pay-checkout:\${ip}\`)
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Wait a moment.' },
      { status: 429 }
    )
  }

  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 400 })
    }

    const result = await createStripeCheckout(token)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Could not create checkout session' },
      { status: 500 }
    )
  }
}
`

// ── app/api/pay/confirm/route.ts ─────────────────────────────
// POST /api/pay/confirm — returns confirmation details after payment
export const confirmRoute = `
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe    = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase  = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { token, session_id } = await req.json()
    if (!session_id) {
      return NextResponse.json({ error: 'Missing session' }, { status: 400 })
    }

    // Retrieve Stripe session
    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not confirmed' }, { status: 400 })
    }

    const invoiceId = session.metadata?.invoice_id
    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoice reference' }, { status: 400 })
    }

    // Get invoice + shop details
    const { data: invoice } = await supabase
      .from('invoices')
      .select(\`
        invoice_number, total,
        shops!inner(name, dba, phone)
      \`)
      .eq('id', invoiceId)
      .single()

    const shop = invoice?.shops
    return NextResponse.json({
      invoice_num:  invoice?.invoice_number,
      amount_paid:  (session.amount_total || 0) / 100,
      shop_name:    shop?.dba || shop?.name,
      shop_phone:   shop?.phone,
    })
  } catch {
    return NextResponse.json({ error: 'Confirmation failed' }, { status: 500 })
  }
}
`

// ── app/api/stripe/webhook/route.ts ──────────────────────────
// POST /api/stripe/webhook — Stripe calls this after every payment
export const webhookRoute = `
import { NextResponse } from 'next/server'
import { handleStripeWebhook } from '@/lib/payments/qr'

export async function POST(req: Request) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  const result = await handleStripeWebhook(body, signature)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ received: true })
}

// IMPORTANT: Stripe webhooks must NOT be parsed as JSON before
// reaching this handler. Add this to your route config:
export const config = { api: { bodyParser: false } }
`

// ── app/api/invoices/[id]/qr/route.ts ────────────────────────
// GET /api/invoices/:id/qr — generates QR for an invoice
// Called by the invoice screen when advisor clicks "Get QR Code"
export const qrGenerateRoute = `
import { NextResponse } from 'next/server'
import { generatePaymentQR } from '@/lib/payments/qr'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { log } from '@/lib/security'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerSupabaseClient()
  const user     = await getCurrentUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only roles that handle invoices can generate QR codes
  const allowed = ['owner','gm','it_person','shop_manager','service_advisor','accountant','office_admin']
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const result = await generatePaymentQR(params.id)

    await log('invoice.qr_generated', user.shop_id, user.id, {
      table: 'invoices', recordId: params.id,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
`

export default { verifyRoute, checkoutRoute, confirmRoute, webhookRoute, qrGenerateRoute }
