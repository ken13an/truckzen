import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { getPermissions } from '@/lib/getPermissions'

// POST /api/platform-admin/impersonate — start or stop shop impersonation
// Safer implementation: do not mutate the canonical users.shop_id.
export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const perms = getPermissions(actor)
  if (!perms.canImpersonate) return jsonError('Access denied', 403)

  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)
  const action = body?.action

  if (action === 'start') {
    const shopId = typeof body?.shop_id === 'string' ? body.shop_id : ''
    if (!shopId) return jsonError('shop_id required', 400)

    const { data: shop, error: shopError } = await s
      .from('shops')
      .select('id, name')
      .eq('id', shopId)
      .single()

    if (shopError || !shop) return jsonError('Shop not found', 404)

    // F-19: require an un-revoked ACL grant for (actor, target shop).
    const { data: acl } = await s
      .from('platform_impersonation_acl')
      .select('user_id')
      .eq('user_id', actor.id)
      .eq('shop_id', shopId)
      .is('revoked_at', null)
      .maybeSingle()
    if (!acl) return jsonError('Impersonation not permitted for this shop', 403)

    const metadata = {
      ...(actor as any),
      platform_impersonation: {
        active: true,
        target_shop_id: shop.id,
        target_shop_name: shop.name,
        started_at: new Date().toISOString(),
      },
    }

    const { error: authError } = await s.auth.admin.updateUserById(actor.id, {
      app_metadata: metadata,
    })
    if (authError) return jsonError(authError.message, 500)

    await s.from('platform_activity_log').insert({
      action_type: 'impersonation_started',
      description: `${actor.full_name || actor.email || actor.id} entered ${shop.name} as Owner`,
      shop_id: shop.id,
      performed_by: actor.id,
      metadata: { original_shop_id: actor.shop_id, target_shop_id: shop.id },
    })

    return NextResponse.json({ ok: true, shop_name: shop.name, original_shop_id: actor.shop_id, target_shop_id: shop.id })
  }

  if (action === 'stop') {
    const { data: authUser, error: authUserError } = await s.auth.admin.getUserById(actor.id)
    if (authUserError) return jsonError(authUserError.message, 500)

    const currentMeta = authUser.user?.app_metadata || {}
    const targetShopId = currentMeta?.platform_impersonation?.target_shop_id || null
    const targetShopName = currentMeta?.platform_impersonation?.target_shop_name || 'Unknown'

    const nextMetadata = { ...currentMeta }
    delete (nextMetadata as any).platform_impersonation

    const { error: clearError } = await s.auth.admin.updateUserById(actor.id, {
      app_metadata: nextMetadata,
    })
    if (clearError) return jsonError(clearError.message, 500)

    await s.from('platform_activity_log').insert({
      action_type: 'impersonation_ended',
      description: `${actor.full_name || actor.email || actor.id} exited ${targetShopName}`,
      shop_id: targetShopId,
      performed_by: actor.id,
    })

    return NextResponse.json({ ok: true })
  }

  return jsonError('Invalid action (start/stop)', 400)
}
