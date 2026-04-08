import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { logAction } from '@/lib/services/auditLog'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = db()
  const { so_line_id } = await req.json()
  if (!so_line_id) return NextResponse.json({ error: 'so_line_id required' }, { status: 400 })

  // 1. Resolve so_line → service_order and verify shop scope
  const { data: line } = await s.from('so_lines')
    .select('id, so_id, service_orders(shop_id)')
    .eq('id', so_line_id)
    .single()

  if (!line) return NextResponse.json({ error: 'Job line not found' }, { status: 404 })

  const woShopId = (line.service_orders as any)?.shop_id
  if (woShopId !== shopId) {
    return NextResponse.json({ error: 'Job does not belong to your shop' }, { status: 403 })
  }

  // 2. Verify mechanic is assigned to this line
  const { data: assignment } = await s.from('wo_job_assignments')
    .select('id')
    .eq('user_id', actor.id)
    .eq('line_id', so_line_id)
    .limit(1)
    .single()

  if (!assignment) {
    return NextResponse.json({ error: 'You are not assigned to this job' }, { status: 403 })
  }

  // 3. Check mechanic is workplace-punched-in
  const { data: punch } = await s.from('work_punches')
    .select('id')
    .eq('user_id', actor.id)
    .is('punch_out_at', null)
    .limit(1)

  if (!punch || punch.length === 0) {
    return NextResponse.json({ error: 'You must punch in to your shift before starting a job.' }, { status: 403 })
  }

  // 4. Check mechanic isn't already clocked into another job
  const { data: active } = await s.from('so_time_entries')
    .select('id, so_id')
    .eq('user_id', actor.id)
    .is('clocked_out_at', null)
    .limit(1)

  if (active && active.length > 0) {
    return NextResponse.json({ error: 'Already clocked into another job. Clock out first.', active_entry: active[0] }, { status: 409 })
  }

  // 4. Insert time entry
  const now = new Date().toISOString()
  const { data: entry, error } = await s.from('so_time_entries')
    .insert({
      shop_id: shopId,
      user_id: actor.id,
      so_id: line.so_id,
      so_line_id,
      clocked_in_at: now,
      clocked_out_at: null,
      duration_minutes: null,
    })
    .select('id, clocked_in_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAction({ shop_id: shopId, user_id: actor.id, action: 'time.clock_in', entity_type: 'time_entry', entity_id: entry.id }).catch(() => {})
  return NextResponse.json(entry)
}
