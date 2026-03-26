/**
 * TruckZen — Original Design
 * Parts department submit — finalize parts, notify mechanic
 */
import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'parts_manager', 'parts_clerk', 'floor_manager', 'service_writer', 'office_admin'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, id, 'id, so_number, shop_id, asset_id, assigned_tech, created_by_user_id, advisor_id, assets(unit_number)')
  if (!wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

  const { action } = await req.json()
  if (action === 'submit_all') {
    await ctx.admin.from('so_lines').update({ parts_status: 'received' })
      .eq('so_id', id).eq('line_type', 'part')
      .in('parts_status', ['rough', 'sourced', 'ordered'])

    await ctx.admin.from('wo_activity_log').insert({
      wo_id: id, user_id: ctx.actor.id,
      action: `Parts submitted by ${ctx.actor.full_name || 'Parts Dept'} — all parts received`,
    })

    if ((wo as any).assigned_tech) {
      await ctx.admin.from('notifications').insert({
        shop_id: (wo as any).shop_id, user_id: (wo as any).assigned_tech, type: 'parts_ready',
        title: 'Parts Ready',
        message: `Parts ready for WO #${(wo as any).so_number} — #${(wo as any).assets?.unit_number || ''}. You can start work.`,
        wo_id: id,
      })
    }

    const writerId = (wo as any).created_by_user_id || (wo as any).advisor_id
    if (writerId) {
      await ctx.admin.from('notifications').insert({
        shop_id: (wo as any).shop_id, user_id: writerId, type: 'parts_sourced',
        title: 'Parts Sourced',
        message: `All parts sourced for WO #${(wo as any).so_number}`,
        wo_id: id,
      })
    }

    return NextResponse.json({ ok: true })
  }

  if (action === 'save_progress') {
    await ctx.admin.from('wo_activity_log').insert({ wo_id: id, user_id: ctx.actor.id, action: 'Parts progress saved' })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
