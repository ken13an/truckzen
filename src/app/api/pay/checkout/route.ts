import { NextResponse } from 'next/server'
import { createStripeCheckout } from '@/lib/payments/qr'
import { checkRateLimit } from '@/lib/security'
import { safeRoute } from '@/lib/api-handler'

async function _POST(req: Request) {
  const ip    = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const limit = await checkRateLimit('api', `pay-checkout:${ip}`)
  if (!limit.allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }
  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 400 })
    }
    const result = await createStripeCheckout(token)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Checkout failed' }, { status: 500 })
  }
}

export const POST = safeRoute(_POST)
