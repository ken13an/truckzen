import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '20')
  const unreadOnly = searchParams.get('unread') === 'true'

  let query = s.from('notifications').select('*')
    .eq('user_id', actor.id)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Normalize: expose is_read as "read" for frontend compatibility
  const normalized = (data || []).map((n: any) => ({ ...n, read: n.is_read ?? n.read ?? false }))

  const { count } = await s.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', actor.id)
    .eq('is_read', false)
    .eq('is_dismissed', false)

  return NextResponse.json({ notifications: normalized, unreadCount: count || 0 })
}

export async function PATCH(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = createAdminSupabaseClient()
  const shopId = getActorShopId(actor)
  const { id, action } = await req.json()

  // Admin roles see all shop notifications on their dashboard, so they need
  // to dismiss/mark-read notifications belonging to any user in their shop.
  const isAdmin = actor.is_platform_owner || ['owner', 'gm', 'it_person', 'office_admin'].includes(actor.role)

  if (action === 'mark_read') {
    if (id === 'all') {
      // Mark all: admin marks all shop notifications, non-admin marks own only
      const q = s.from('notifications').update({ is_read: true }).eq('is_read', false)
      const { error } = isAdmin && shopId
        ? await q.eq('shop_id', shopId)
        : await q.eq('user_id', actor.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // Single: admin can mark any in their shop, non-admin only own
      const q = s.from('notifications').update({ is_read: true }).eq('id', id)
      const { error } = isAdmin && shopId
        ? await q.eq('shop_id', shopId)
        : await q.eq('user_id', actor.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (action === 'dismiss') {
    const q = s.from('notifications').update({ is_dismissed: true }).eq('id', id)
    const { error } = isAdmin && shopId
      ? await q.eq('shop_id', shopId)
      : await q.eq('user_id', actor.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
