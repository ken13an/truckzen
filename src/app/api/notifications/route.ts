import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

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

  if (unreadOnly) query = query.eq('read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count } = await s.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', actor.id)
    .eq('read', false)
    .eq('is_dismissed', false)

  return NextResponse.json({ notifications: data || [], unreadCount: count || 0 })
}

export async function PATCH(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = createAdminSupabaseClient()
  const { id, action } = await req.json()

  if (action === 'mark_read') {
    if (id === 'all') {
      await s.from('notifications').update({ read: true, is_read: true }).eq('user_id', actor.id).eq('read', false)
    } else {
      await s.from('notifications').update({ read: true, is_read: true }).eq('id', id).eq('user_id', actor.id)
    }
  }

  if (action === 'dismiss') {
    await s.from('notifications').update({ is_dismissed: true }).eq('id', id).eq('user_id', actor.id)
  }

  return NextResponse.json({ success: true })
}
