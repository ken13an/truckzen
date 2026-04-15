import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sendWelcomeEmail } from '@/lib/integrations/resend'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser, requireRole } from '@/lib/route-guards'
import { MANAGEMENT_ROLES } from '@/lib/roles'
import { logAction } from '@/lib/services/auditLog'
import { checkInviteSendLimits } from '@/lib/ratelimit/invite-guard'

const INVITE_ROLES = MANAGEMENT_ROLES
const INVITE_EXPIRY_DAYS = 7

export async function POST(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, INVITE_ROLES)
  if (roleError) return roleError

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : 'Team Member'
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const inviteGuard = await checkInviteSendLimits(actor.id, email)
  if (inviteGuard !== true) return inviteGuard

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { data: matches, error: lookupErr } = await s.from('users')
    .select('id, email, shop_id, invite_accepted_at, deleted_at')
    .eq('email', email)
    .eq('shop_id', shopId)
  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 })
  const liveMatches = (matches || []).filter((r: any) => !r.deleted_at)
  if (liveMatches.length === 0) return NextResponse.json({ error: 'User not found in your shop' }, { status: 404 })
  if (liveMatches.length > 1) {
    return NextResponse.json({
      error: 'Duplicate profile rows exist for this email in your shop. Please reconcile before resending.',
      code: 'duplicate_profiles',
      rows: liveMatches.map((r: any) => ({ id: r.id, accepted: !!r.invite_accepted_at })),
    }, { status: 409 })
  }
  const targetUser = liveMatches[0]
  if (targetUser.invite_accepted_at) {
    return NextResponse.json({
      error: 'This account is already active. Ask the user to sign in, or send a password reset.',
      code: 'already_active',
    }, { status: 409 })
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error: updErr } = await s.from('users')
    .update({ invite_token: token, invite_expires_at: expiresAt, invite_accepted_at: null })
    .eq('id', targetUser.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
  const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`

  const { data: shop } = await s.from('shops').select('name, dba').eq('id', shopId).single()
  const shopName = shop?.dba || shop?.name || 'TruckZen'

  const result = await sendWelcomeEmail(email, fullName, shopName, acceptUrl)
  if (!result.success) return NextResponse.json({ error: result.error || 'Failed to send' }, { status: 500 })

  logAction({
    shop_id: shopId,
    user_id: actor.id,
    action: 'user.invite_resent',
    entity_type: 'user',
    entity_id: targetUser.id,
    details: { email },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
