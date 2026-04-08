import { getAuthenticatedUserProfile, createAdminSupabaseClient, jsonError, type AuthenticatedUser } from '@/lib/server-auth'
import { MANAGEMENT_ROLES, ACCOUNTING_ROLES } from '@/lib/roles'

export { MANAGEMENT_ROLES, ACCOUNTING_ROLES }

export async function requireAuthenticatedUser() {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return { error: jsonError('Unauthorized', 401) as Response, actor: null }
  return { actor, error: null }
}

export function requireRole(actor: AuthenticatedUser, allowed: readonly string[]) {
  // Platform owner not impersonating → always allowed
  if (actor.is_platform_owner && !actor.impersonate_role) return null
  // Use effective role (impersonated or real)
  const effectiveRole = actor.impersonate_role || actor.role
  if (!allowed.includes(effectiveRole)) return jsonError('Forbidden', 403)
  return null
}

export function requireShop(actor: AuthenticatedUser) {
  const shopId = actor.effective_shop_id || actor.shop_id
  if (!shopId) return { shopId: null, error: jsonError('No shop context', 400) as Response }
  return { shopId, error: null }
}

export async function requirePlatformOwner() {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return { error: jsonError('Unauthorized', 401) as Response, actor: null }
  if (!actor.is_platform_owner) return { error: jsonError('Access denied', 403) as Response, actor: null }
  return { actor, error: null }
}

export async function ensureUserInShop(userId: string, shopId: string) {
  const s = createAdminSupabaseClient()
  const { data } = await s.from('users').select('id').eq('id', userId).eq('shop_id', shopId).is('deleted_at', null).single()
  return !!data
}
