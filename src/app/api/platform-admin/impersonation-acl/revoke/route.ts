import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.is_platform_owner) return jsonError('Access denied — platform owners only', 403)
  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)
  const userId = typeof body?.user_id === 'string' ? body.user_id : ''
  const shopId = typeof body?.shop_id === 'string' ? body.shop_id : ''
  const reasonIn = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!userId || !shopId) return jsonError('user_id and shop_id required', 400)

  const { data: existing } = await s.from('platform_impersonation_acl')
    .select('user_id, shop_id, revoked_at, reason').eq('user_id', userId).eq('shop_id', shopId).maybeSingle()
  if (!existing) return jsonError('ACL row not found', 404)
  if (existing.revoked_at) return NextResponse.json({ ok: true, row: existing, alreadyRevoked: true })

  const patch: Record<string, unknown> = { revoked_at: new Date().toISOString() }
  if (reasonIn) patch.reason = reasonIn
  const { data: updated, error: upErr } = await s.from('platform_impersonation_acl')
    .update(patch).eq('user_id', userId).eq('shop_id', shopId).select().single()
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, row: updated, alreadyRevoked: false })
}
