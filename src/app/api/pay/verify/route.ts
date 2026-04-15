import { NextResponse } from 'next/server'
import { verifyPaymentToken } from '@/lib/payments/qr'
import { rateLimit } from '@/lib/ratelimit/core'
import { getRequestIp } from '@/lib/ratelimit/request-ip'
import { safeRoute } from '@/lib/api-handler'

async function _POST(req: Request) {
  const ip    = getRequestIp(req)
  const limit = await rateLimit('pay-ip', ip)
  if (!limit.allowed) {
    return NextResponse.json({ valid: false, error: 'Too many payment attempts' }, { status: 429 })
  }
  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string' || token.length > 600) {
      return NextResponse.json({ valid: false, error: 'Invalid token' })
    }
    const result = await verifyPaymentToken(token)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ valid: false, error: 'Verification failed' })
  }
}

export const POST = safeRoute(_POST)
