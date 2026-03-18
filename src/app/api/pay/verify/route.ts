import { NextResponse } from 'next/server'
import { verifyPaymentToken } from '@/lib/payments/qr'
import { checkRateLimit } from '@/lib/security'

export async function POST(req: Request) {
  const ip    = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const limit = await checkRateLimit('api', `pay-verify:${ip}`)
  if (!limit.allowed) {
    return NextResponse.json({ valid: false, error: 'Too many requests' }, { status: 429 })
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
