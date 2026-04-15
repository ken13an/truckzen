import { NextResponse } from 'next/server'
import { createStripeCheckout } from '@/lib/payments/qr'
import { rateLimit } from '@/lib/ratelimit/core'
import { getRequestIp } from '@/lib/ratelimit/request-ip'
import { safeRoute } from '@/lib/api-handler'

async function _POST(req: Request) {
  const ip    = getRequestIp(req)
  const limit = await rateLimit('pay-ip', ip)
  if (!limit.allowed) {
    return NextResponse.json({ success: false, error: 'Too many payment attempts' }, { status: 429 })
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
