import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError, requireRoles, type AuthenticatedUser } from '@/lib/server-auth'
import { MANAGEMENT_ROLES, ACCOUNTING_ROLES } from '@/lib/route-guards'

export type RouteContext = {
  actor: AuthenticatedUser
  shopId: string
  admin: ReturnType<typeof createAdminSupabaseClient>
}

export async function requireRouteContext(allowedRoles?: readonly string[]) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return { error: jsonError('Unauthorized', 401) as Response, actor: null, shopId: null, admin: null }
  const shopId = getActorShopId(actor)
  if (!shopId && !actor.is_platform_owner) return { error: jsonError('No shop context', 400) as Response, actor, shopId: null, admin: null }
  if (allowedRoles?.length) {
    const err = requireRoles(actor, [...allowedRoles])
    if (err) return { error: jsonError(err, 403) as Response, actor, shopId: null, admin: null }
  }
  return { actor, shopId: shopId || null, admin: createAdminSupabaseClient(), error: null }
}

export async function requireManagementContext() {
  return requireRouteContext(MANAGEMENT_ROLES)
}

export async function requireAccountingContext() {
  return requireRouteContext(ACCOUNTING_ROLES)
}

export async function getWorkOrderForActor(admin: ReturnType<typeof createAdminSupabaseClient>, actor: AuthenticatedUser, workOrderId: string, select = 'id, shop_id') {
  const q = admin.from('service_orders').select(select).eq('id', workOrderId)
  if (!actor.is_platform_owner) q.eq('shop_id', getActorShopId(actor))
  const { data, error } = await q.single()
  return { data, error }
}

export async function getSoLineForActor(admin: ReturnType<typeof createAdminSupabaseClient>, actor: AuthenticatedUser, lineId: string, select = 'id, so_id, service_order_id, line_type') {
  const { data, error } = await admin
    .from('so_lines')
    .select(select)
    .eq('id', lineId)
    .single()

  if (error || !data) return { data: null, error: error || new Error('Not found') }

  const serviceOrderId = (data as any).so_id || (data as any).service_order_id
  if (serviceOrderId) {
    const { data: workOrder } = await getWorkOrderForActor(admin, actor, serviceOrderId, 'id, shop_id')
    if (!workOrder) return { data: null, error: new Error('Forbidden') }
  }

  return { data, error: null }
}
