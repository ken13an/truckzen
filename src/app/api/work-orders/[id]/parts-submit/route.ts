/**
 * TruckZen — Original Design
 * Parts department submit — finalize parts, notify mechanic
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const { user_id, action } = await req.json()

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: wo } = await s.from('service_orders')
    .select('id, so_number, shop_id, asset_id, assigned_tech, created_by_user_id, advisor_id, assets(unit_number)')
    .eq('id', id).single()

  if (!wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

  if (action === 'submit_all') {
    // Update all parts to received (rough parts are accepted — parts dept fills names after)
    const { data: partLines } = await s.from('so_lines')
      .select('id, real_name, rough_name, parts_status, quantity')
      .eq('so_id', id).eq('line_type', 'part')

    // Update all sourced parts to received
    await s.from('so_lines').update({ parts_status: 'received' })
      .eq('so_id', id).eq('line_type', 'part')
      .in('parts_status', ['rough', 'sourced', 'ordered'])

    // Activity log
    const { data: partsUser } = await s.from('users').select('full_name').eq('id', user_id).single()
    await s.from('wo_activity_log').insert({
      wo_id: id, user_id,
      action: `Parts submitted by ${partsUser?.full_name || 'Parts Dept'} — all parts received`,
    })

    // Notify mechanic
    if (wo.assigned_tech) {
      await s.from('notifications').insert({
        shop_id: wo.shop_id, user_id: wo.assigned_tech, type: 'parts_ready',
        title: 'Parts Ready',
        message: `Parts ready for WO #${wo.so_number} — #${(wo.assets as any)?.unit_number || ''}. You can start work.`,
        wo_id: id,
      })
    }

    // Notify service writer
    const writerId = wo.created_by_user_id || wo.advisor_id
    if (writerId) {
      await s.from('notifications').insert({
        shop_id: wo.shop_id, user_id: writerId, type: 'parts_sourced',
        title: 'Parts Sourced',
        message: `All parts sourced for WO #${wo.so_number}`,
        wo_id: id,
      })
    }

    return NextResponse.json({ ok: true })
  }

  if (action === 'save_progress') {
    // Just log — actual field saves happen via patchLine individually
    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: 'Parts progress saved' })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
