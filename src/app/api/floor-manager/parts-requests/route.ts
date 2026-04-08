import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

const ALLOWED_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'floor_manager', 'service_manager', 'parts_manager', 'office_admin']

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ALLOWED_ROLES.includes(actor.impersonate_role || actor.role) && !(actor.is_platform_owner && !actor.impersonate_role)) return jsonError('Forbidden', 403)

  const s = createAdminSupabaseClient()
  const { data } = await s.from('parts_requests')
    .select('*, users:requested_by(full_name)')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json(data || [])
}

export async function PATCH(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ALLOWED_ROLES.includes(actor.impersonate_role || actor.role) && !(actor.is_platform_owner && !actor.impersonate_role)) return jsonError('Forbidden', 403)

  const s = createAdminSupabaseClient()
  const { id, action, reason, in_stock } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  const now = new Date().toISOString()

  if (action === 'approve') {
    const update: any = { status: in_stock ? 'in_stock' : 'ordered', approved_by_user_id: actor.id, approved_at: now }
    if (in_stock) { update.in_stock = true; update.ready_at = now }
    else { update.in_stock = false; update.ordered_at = now }
    await s.from('parts_requests').update(update).eq('id', id).eq('shop_id', shopId)
  } else if (action === 'deny') {
    await s.from('parts_requests').update({ status: 'rejected', rejected_reason: reason || null }).eq('id', id).eq('shop_id', shopId)
  } else if (action === 'ready') {
    await s.from('parts_requests').update({ status: 'ready', ready_at: now }).eq('id', id).eq('shop_id', shopId)
  } else if (action === 'picked_up') {
    await s.from('parts_requests').update({ status: 'picked_up', picked_up_at: now }).eq('id', id).eq('shop_id', shopId)
  }

  return NextResponse.json({ ok: true })
}
