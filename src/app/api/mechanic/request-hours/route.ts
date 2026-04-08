import { NextResponse } from 'next/server'
import { getAuthenticatedUserProfile, jsonError, getActorShopId } from '@/lib/server-auth'
import { notifyRole } from '@/lib/notify'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const { assignment_id, wo_number, job_description, request_type, requested_minutes } = await req.json()
  if (!assignment_id) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 })

  // Verify assignment belongs to this mechanic + get WO ID and current hours
  const s = db()
  const { data: assign } = await s.from('wo_job_assignments').select('id, line_id, so_lines(so_id, estimated_hours)').eq('id', assignment_id).eq('user_id', actor.id).single()
  if (!assign) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const woId = (assign.so_lines as any)?.so_id
  const currentEstimated = (assign.so_lines as any)?.estimated_hours || 0

  // Get worked time for context
  let workedMinutes = 0
  if (assign.line_id) {
    const { data: entries } = await s.from('so_time_entries')
      .select('duration_minutes').eq('so_line_id', assign.line_id).eq('user_id', actor.id).not('duration_minutes', 'is', null)
    workedMinutes = (entries || []).reduce((sum: number, e: any) => sum + (e.duration_minutes || 0), 0)
  }
  const workedHrs = +(workedMinutes / 60).toFixed(1)

  const isMoreTime = request_type === 'more_time' && currentEstimated > 0
  const requestedLabel = requested_minutes ? (requested_minutes >= 60 ? `${requested_minutes / 60}h` : `${requested_minutes}min`) : ''

  const title = isMoreTime
    ? `More time needed: ${wo_number || 'WO'}`
    : `Hours needed: ${wo_number || 'WO'}`

  const body = isMoreTime
    ? `${actor.full_name || 'Mechanic'} needs more time for: ${job_description || 'job'}. Book: ${currentEstimated}h, Worked: ${workedHrs}h${requestedLabel ? `, Requesting: +${requestedLabel}` : ''}. Open WO to update hours.`
    : `${actor.full_name || 'Mechanic'} needs book/expected hours set for: ${job_description || 'job'}. Mechanic cannot start work without hours.`

  const logAction = isMoreTime
    ? `Mechanic requested more time for ${wo_number || 'WO'}: ${job_description || 'job'} (book: ${currentEstimated}h, worked: ${workedHrs}h${requestedLabel ? `, requesting +${requestedLabel}` : ''})`
    : `Mechanic requested hours for ${wo_number || 'WO'}: ${job_description || 'job'}`

  try {
    await notifyRole({
      shopId,
      role: ['shop_manager', 'service_writer', 'owner', 'gm', 'floor_manager'],
      type: isMoreTime ? 'hours_request_more' : 'hours_request_needed',
      title,
      body,
      link: woId ? `/work-orders/${woId}` : undefined,
    })
  } catch {}

  try {
    await s.from('wo_activity_log').insert({
      wo_id: woId || null, user_id: actor.id,
      action: logAction,
    })
  } catch {}

  return NextResponse.json({ ok: true })
}
