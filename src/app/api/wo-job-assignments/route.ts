import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'

async function resolveAssignmentUsers(admin: any, assignments: any[]) {
  const userIds = [...new Set(assignments.map((a: any) => a.user_id).filter(Boolean))]
  if (userIds.length === 0) return assignments
  const { data: users } = await admin.from('users').select('id, full_name, team').in('id', userIds)
  const map: Record<string, any> = {}
  if (users) for (const u of users) map[u.id] = { id: u.id, full_name: u.full_name, team: u.team }
  return assignments.map((a: any) => ({ ...a, users: map[a.user_id] || null }))
}

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const searchParams = new URL(req.url).searchParams
  const lineId = searchParams.get('line_id')
  const woId = searchParams.get('wo_id')

  if (lineId) {
    const { data: line } = await ctx.admin.from('so_lines').select('so_id, service_order_id').eq('id', lineId).single()
    const targetWoId = (line as any)?.so_id || (line as any)?.service_order_id
    if (!targetWoId) return NextResponse.json([])
    const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, targetWoId, 'id')
    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data, error } = await ctx.admin.from('wo_job_assignments').select('*').eq('line_id', lineId).order('created_at').limit(100)
    if (error) return NextResponse.json([])
    return NextResponse.json(await resolveAssignmentUsers(ctx.admin, data || []))
  }

  if (woId) {
    const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, woId, 'id')
    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data: lines } = await ctx.admin.from('so_lines').select('id').eq('so_id', woId)
    if (!lines || lines.length === 0) return NextResponse.json([])
    const lineIds = lines.map((l: any) => l.id)
    const { data, error } = await ctx.admin.from('wo_job_assignments').select('*').in('line_id', lineIds).order('created_at').limit(500)
    if (error) return NextResponse.json([])
    return NextResponse.json(await resolveAssignmentUsers(ctx.admin, data || []))
  }

  return NextResponse.json({ error: 'line_id or wo_id required' }, { status: 400 })
}

export async function POST(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'floor_manager', 'service_writer', 'office_admin'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { line_id, assignments, wo_id } = await req.json().catch(() => ({}))
  if (!line_id || !Array.isArray(assignments)) return NextResponse.json({ error: 'line_id and assignments[] required' }, { status: 400 })
  const targetWoId = wo_id || (await ctx.admin.from('so_lines').select('so_id, service_order_id').eq('id', line_id).single()).data?.so_id
  if (!targetWoId) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, targetWoId, 'id, shop_id, so_number, assets(unit_number)')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await ctx.admin.from('wo_job_assignments').delete().eq('line_id', line_id)
  if (assignments.length > 0) {
    const rows = assignments.filter((a: any) => a.user_id).map((a: any) => ({ line_id, user_id: a.user_id, percentage: a.percentage || 100, status: 'assigned' }))
    if (rows.length > 0) {
      const { error } = await ctx.admin.from('wo_job_assignments').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await ctx.admin.from('so_lines').update({ assigned_to: rows[0].user_id, line_status: 'in_progress' }).eq('id', line_id)
      try {
        const { createNotification } = await import('@/lib/createNotification')
        const unitNum = (wo as any).assets?.unit_number || ''
        // Dedup: dismiss existing unread job_assigned notifications for this WO before creating new ones
        for (const r of rows) {
          await ctx.admin.from('notifications')
            .update({ is_dismissed: true })
            .eq('user_id', r.user_id)
            .eq('type', 'job_assigned')
            .eq('related_wo_id', targetWoId)
            .eq('is_dismissed', false)
        }
        await createNotification({ shopId: (wo as any).shop_id, recipientId: rows.map((r: any) => r.user_id), type: 'job_assigned', title: 'New Job Assigned', body: `You've been assigned to ${(wo as any).so_number} #${unitNum}`, link: `/work-orders/${targetWoId}`, relatedWoId: targetWoId, relatedUnit: unitNum })
      } catch {}
    }
  } else {
    await ctx.admin.from('so_lines').update({ assigned_to: null, line_status: 'unassigned' }).eq('id', line_id)
  }

  const names = assignments.map((a: any) => `${a.name || 'Mechanic'} (${a.percentage || 100}%)`).join(', ')
  await ctx.admin.from('wo_activity_log').insert({ wo_id: targetWoId, user_id: ctx.actor.id, action: assignments.length > 0 ? `Assigned mechanics: ${names}` : 'Unassigned all mechanics' })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'floor_manager', 'service_writer', 'office_admin'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: assignment } = await ctx.admin.from('wo_job_assignments').select('id, line_id').eq('id', id).single()
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: line } = await ctx.admin.from('so_lines').select('so_id, service_order_id').eq('id', (assignment as any).line_id).single()
  const targetWoId = (line as any)?.so_id || (line as any)?.service_order_id
  if (!targetWoId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, targetWoId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await ctx.admin.from('wo_job_assignments').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
