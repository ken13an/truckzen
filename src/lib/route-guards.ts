import { getAuthenticatedUserProfile, createAdminSupabaseClient, jsonError, type AuthenticatedUser } from '@/lib/server-auth'

export const MANAGEMENT_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'office_admin'] as const
export const ACCOUNTING_ROLES = ['owner', 'gm', 'it_person', 'accountant', 'office_admin', 'accounting_manager'] as const

export async function requireAuthenticatedUser() {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return { error: jsonError('Unauthorized', 401) as Response, actor: null }
  return { actor, error: null }
}

export function requireRole(actor: AuthenticatedUser, allowed: readonly string[]) {
  if (actor.is_platform_owner) return null
  if (!allowed.includes(actor.role)) return jsonError('Forbidden', 403)
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
