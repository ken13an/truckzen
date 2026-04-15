// Shared per-admin + per-recipient limiter for invite send and resend-invite.
// Keeps one canonical guard so both routes enforce identical policies.
import { NextResponse } from 'next/server'
import { rateLimit } from './core'

export async function checkInviteSendLimits(
  actorId: string,
  recipientEmail: string,
): Promise<true | Response> {
  const adminLimit = await rateLimit('invite-admin', actorId)
  if (!adminLimit.allowed) {
    return NextResponse.json({ error: 'Too many invite attempts' }, { status: 429 })
  }
  if (recipientEmail) {
    const recipLimit = await rateLimit('invite-recipient', recipientEmail)
    if (!recipLimit.allowed) {
      return NextResponse.json({ error: 'Too many invite attempts' }, { status: 429 })
    }
  }
  return true
}
