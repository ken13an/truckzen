import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify SO belongs to shop
  const { data: so } = await supabase.from('service_orders').select('id, so_number').eq('id', id).eq('shop_id', user.shop_id).single()
  if (!so) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get all audit log entries for this SO
  const { data: logs } = await supabase
    .from('audit_log')
    .select('id, action, old_data, new_data, created_at, users(full_name, role)')
    .eq('shop_id', user.shop_id)
    .eq('record_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  // Also get time entries
  const { data: timeEntries } = await supabase
    .from('so_time_entries')
    .select('id, clocked_in_at, clocked_out_at, duration_minutes, users(full_name)')
    .eq('so_id', id)
    .order('clocked_in_at', { ascending: false })

  // Also get parts requests
  const { data: partsRequests } = await supabase
    .from('parts_requests')
    .select('id, description, status, priority, requested_at, users!requested_by(full_name)')
    .eq('so_id', id)
    .order('requested_at', { ascending: false })

  // Merge into unified timeline
  const timeline: any[] = []

  for (const log of logs || []) {
    const action = log.action?.replace(/\./g, ' ').replace(/_/g, ' ')
    const user   = (log as any).users
    let detail   = ''

    if (log.action === 'so.status_changed') {
      detail = `${(log.old_data as any)?.status} → ${(log.new_data as any)?.status}`
    } else if (log.action === 'so.created') {
      detail = `Created by ${user?.full_name || '—'}`
    } else if (log.action === 'so.updated') {
      const changed = Object.keys((log.new_data as any) || {}).join(', ')
      detail = `Updated: ${changed}`
    }

    timeline.push({
      type:       'audit',
      action,
      detail,
      user_name:  user?.full_name,
      user_role:  user?.role,
      timestamp:  log.created_at,
      icon:       '',
    })
  }

  for (const te of timeEntries || []) {
    const user = (te as any).users
    if (te.clocked_out_at && te.duration_minutes) {
      timeline.push({
        type:      'time',
        action:    'Time logged',
        detail:    `${Math.floor(te.duration_minutes / 60)}h ${te.duration_minutes % 60}m`,
        user_name: user?.full_name,
        timestamp: te.clocked_in_at,
        icon:      '',
      })
    }
  }

  for (const pr of partsRequests || []) {
    const user = (pr as any).users
    timeline.push({
      type:      'parts',
      action:    `Parts request — ${pr.status}`,
      detail:    pr.description,
      user_name: user?.full_name,
      timestamp: pr.requested_at,
      icon:      '',
    })
  }

  // Sort by timestamp descending
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({ so_number: so.so_number, timeline })
}
