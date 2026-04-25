import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { WO_FULL_ACCESS_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'

type P = { params: Promise<{ id: string }> }

// Service-order audit/time/parts timeline. Auth-required and SO ownership
// must match actor shop. Path id is no longer trusted to grant cross-shop
// read.
async function _GET(_req: Request, { params }: P) {
  const ctx = await requireRouteContext([...WO_FULL_ACCESS_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const { id } = await params
  const s = createAdminSupabaseClient()

  const { data: so } = await s.from('service_orders').select('id, so_number, shop_id').eq('id', id).single()
  if (!so) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!ctx.actor.is_platform_owner && so.shop_id !== shopId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: logs } = await s
    .from('audit_log')
    .select('id, action, old_data, new_data, created_at, users(full_name, role)')
    .eq('shop_id', so.shop_id)
    .eq('record_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: timeEntries } = await s
    .from('so_time_entries')
    .select('id, clocked_in_at, clocked_out_at, duration_minutes, users(full_name)')
    .eq('so_id', id)
    .is('deleted_at', null)
    .order('clocked_in_at', { ascending: false })

  const { data: partsRequests } = await s
    .from('parts_requests')
    .select('id, description, status, priority, requested_at, users!requested_by(full_name)')
    .eq('so_id', id)
    .is('deleted_at', null)
    .order('requested_at', { ascending: false })

  const timeline: any[] = []

  for (const log of logs || []) {
    const action = log.action?.replace(/\./g, ' ').replace(/_/g, ' ')
    const u = (log as any).users
    let detail = ''
    if (log.action === 'so.status_changed') {
      detail = `${(log.old_data as any)?.status} → ${(log.new_data as any)?.status}`
    } else if (log.action === 'so.created') {
      detail = `Created by ${u?.full_name || '—'}`
    } else if (log.action === 'so.updated') {
      detail = `Updated: ${Object.keys((log.new_data as any) || {}).join(', ')}`
    }
    timeline.push({ type: 'audit', action, detail, user_name: u?.full_name, user_role: u?.role, timestamp: log.created_at, icon: '' })
  }

  for (const te of timeEntries || []) {
    const u = (te as any).users
    if (te.clocked_out_at && te.duration_minutes) {
      timeline.push({ type: 'time', action: 'Time logged', detail: `${Math.floor(te.duration_minutes / 60)}h ${te.duration_minutes % 60}m`, user_name: u?.full_name, timestamp: te.clocked_in_at, icon: '' })
    }
  }

  for (const pr of partsRequests || []) {
    const u = (pr as any).users
    timeline.push({ type: 'parts', action: `Parts request — ${pr.status}`, detail: pr.description, user_name: u?.full_name, timestamp: pr.requested_at, icon: '' })
  }

  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return NextResponse.json({ so_number: so.so_number, timeline })
}

export const GET = safeRoute(_GET)
