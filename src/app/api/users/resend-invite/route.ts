import { NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/integrations/resend'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser, requireRole } from '@/lib/route-guards'
import { MANAGEMENT_ROLES } from '@/lib/roles'
import { logAction } from '@/lib/services/auditLog'

const INVITE_ROLES = MANAGEMENT_ROLES

export async function POST(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, INVITE_ROLES)
  if (roleError) return roleError

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : 'Team Member'
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { data: targetUser } = await s.from('users').select('id, email, shop_id').eq('email', email).eq('shop_id', shopId).single()
  if (!targetUser) return NextResponse.json({ error: 'User not found in your shop' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
  const { data: linkData, error: linkErr } = await s.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${appUrl}/reset-password` },
  })
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })

  const { data: shop } = await s.from('shops').select('name, dba').eq('id', shopId).single()
  const shopName = shop?.dba || shop?.name || 'TruckZen'
  const setupUrl = linkData?.properties?.action_link || `${appUrl}/forgot-password`

  const result = await sendWelcomeEmail(email, fullName, shopName, setupUrl)
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
