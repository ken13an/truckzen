// Shared per-IP + per-token limiter for /api/portal/[token]/* handlers.
// Each handler early-returns 429 via the helper below instead of duplicating
// limiter code.
import { NextResponse } from 'next/server'
import { rateLimit } from './core'
import { getRequestIp } from './request-ip'

export async function checkPortalLimits(req: Request, token: string): Promise<true | Response> {
  const ip = getRequestIp(req)
  const ipLimit = await rateLimit('portal-ip', ip)
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many portal requests' }, { status: 429 })
  }
  if (token) {
    const tokenLimit = await rateLimit('portal-token', token)
    if (!tokenLimit.allowed) {
      return NextResponse.json({ error: 'Too many portal requests' }, { status: 429 })
    }
  }
  return true
}
