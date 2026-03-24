import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const limit = parseInt(searchParams.get('limit') || '20')
  const unreadOnly = searchParams.get('unread') === 'true'

  let query = s.from('notifications').select('*')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.eq('read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count } = await s.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .eq('is_dismissed', false)

  return NextResponse.json({ notifications: data || [], unreadCount: count || 0 })
}

export async function PATCH(req: Request) {
  const s = db()
  const { id, action, user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  if (action === 'mark_read') {
    if (id === 'all') {
      await s.from('notifications').update({ read: true, is_read: true }).eq('user_id', user_id).eq('read', false)
    } else {
      await s.from('notifications').update({ read: true, is_read: true }).eq('id', id).eq('user_id', user_id)
    }
  }

  if (action === 'dismiss') {
    await s.from('notifications').update({ is_dismissed: true }).eq('id', id).eq('user_id', user_id)
  }

  return NextResponse.json({ success: true })
}
