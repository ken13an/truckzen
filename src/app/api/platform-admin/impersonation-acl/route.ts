import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

async function requirePlatformOwner() {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return { actor: null, error: jsonError('Unauthorized', 401) as NextResponse }
  if (!actor.is_platform_owner) return { actor: null, error: jsonError('Access denied — platform owners only', 403) as NextResponse }
  return { actor, error: null as NextResponse | null }
}

export async function GET(req: Request) {
  const { actor, error } = await requirePlatformOwner()
  if (error || !actor) return error!
  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id') || ''
  const shopId = searchParams.get('shop_id') || ''
  const status = (searchParams.get('status') || 'active').toLowerCase()

  let q = s.from('platform_impersonation_acl')
    .select('user_id, shop_id, granted_by, granted_at, revoked_at, reason, user:users!platform_impersonation_acl_user_id_fkey(id, full_name, email), shop:shops!platform_impersonation_acl_shop_id_fkey(id, name)')
  if (userId) q = q.eq('user_id', userId)
  if (shopId) q = q.eq('shop_id', shopId)
  if (status === 'active')       q = q.is('revoked_at', null)
  else if (status === 'revoked') q = q.not('revoked_at', 'is', null)
  q = q.order('revoked_at', { ascending: true, nullsFirst: true }).order('granted_at', { ascending: false })

  const [rowsRes, ownersRes, shopsRes] = await Promise.all([
    q,
    s.from('users').select('id, full_name, email').eq('is_platform_owner', true).order('full_name'),
    s.from('shops').select('id, name').order('name'),
  ])
  if (rowsRes.error) return NextResponse.json({ error: rowsRes.error.message }, { status: 500 })
  return NextResponse.json({ rows: rowsRes.data || [], owners: ownersRes.data || [], shops: shopsRes.data || [] })
}

export async function POST(req: Request) {
  const { actor, error } = await requirePlatformOwner()
  if (error || !actor) return error!
  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)
  const userId = typeof body?.user_id === 'string' ? body.user_id : ''
  const shopId = typeof body?.shop_id === 'string' ? body.shop_id : ''
  const reasonIn = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!userId || !shopId) return jsonError('user_id and shop_id required', 400)

  const { data: targetUser } = await s.from('users').select('id, is_platform_owner').eq('id', userId).maybeSingle()
  if (!targetUser) return jsonError('User not found', 404)
  if (!targetUser.is_platform_owner) return jsonError('Target user is not a platform owner', 400)
  const { data: targetShop } = await s.from('shops').select('id').eq('id', shopId).maybeSingle()
  if (!targetShop) return jsonError('Shop not found', 404)

  const { data: existing } = await s.from('platform_impersonation_acl')
    .select('user_id, shop_id, revoked_at, reason').eq('user_id', userId).eq('shop_id', shopId).maybeSingle()

  const now = new Date().toISOString()
  if (existing) {
    const nextReason = reasonIn || existing.reason || 'manual-grant'
    const { data: updated, error: upErr } = await s.from('platform_impersonation_acl')
      .update({ revoked_at: null, granted_at: now, granted_by: actor.id, reason: nextReason })
      .eq('user_id', userId).eq('shop_id', shopId).select().single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, row: updated, reactivated: existing.revoked_at !== null })
  }

  const { data: inserted, error: insErr } = await s.from('platform_impersonation_acl')
    .insert({ user_id: userId, shop_id: shopId, granted_by: actor.id, granted_at: now, reason: reasonIn || 'manual-grant' })
    .select().single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, row: inserted, reactivated: false })
}
