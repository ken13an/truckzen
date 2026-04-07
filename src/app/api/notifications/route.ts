import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '20')
  const unreadOnly = searchParams.get('unread') === 'true'

  // Filter notifications by effective role during impersonation
  const effectiveRole = actor.impersonate_role || actor.role
  const ROLE_NOTIF_TYPES: Record<string, string[]> = {
    accountant: ['invoice_approved', 'invoice_submitted', 'invoice_returned', 'payment_received'],
    accounting_manager: ['invoice_approved', 'invoice_submitted', 'invoice_returned', 'payment_received'],
    technician: ['job_assigned', 'parts_ready', 'wo_started'],
    lead_tech: ['job_assigned', 'parts_ready', 'wo_started'],
    maintenance_technician: ['job_assigned', 'parts_ready', 'wo_started'],
    parts_manager: ['parts_request', 'parts_ready'],
    fleet_manager: ['wo_ready', 'wo_completed'],
    maintenance_manager: ['wo_ready', 'wo_completed'],
    dispatcher: ['wo_ready', 'wo_completed'],
    service_writer: ['invoice_returned', 'wo_ready', 'wo_completed', 'estimate_approved', 'estimate_declined', 'checkin_alert'],
  }

  let query = s.from('notifications').select('*')
    .eq('user_id', actor.id)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  // If impersonating a specific role, filter to only that role's notification types
  if (actor.impersonate_role && ROLE_NOTIF_TYPES[effectiveRole]) {
    query = query.in('type', ROLE_NOTIF_TYPES[effectiveRole])
  }

  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Normalize: expose is_read as "read" for frontend compatibility
  const normalized = (data || []).map((n: any) => ({ ...n, read: n.is_read ?? n.read ?? false }))

  let countQ = s.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', actor.id)
    .eq('is_read', false)
    .eq('is_dismissed', false)
  if (actor.impersonate_role && ROLE_NOTIF_TYPES[effectiveRole]) {
    countQ = countQ.in('type', ROLE_NOTIF_TYPES[effectiveRole])
  }
  const { count } = await countQ

  return NextResponse.json({ notifications: normalized, unreadCount: count || 0 })
}

export async function PATCH(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = createAdminSupabaseClient()
  const { id, action } = await req.json()

  // Notifications are person-dedicated — always scoped to current user only
  if (action === 'mark_read') {
    if (id === 'all') {
      const { error } = await s.from('notifications').update({ is_read: true }).eq('user_id', actor.id).eq('is_read', false)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await s.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', actor.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (action === 'dismiss') {
    const { error } = await s.from('notifications').update({ is_dismissed: true }).eq('id', id).eq('user_id', actor.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
