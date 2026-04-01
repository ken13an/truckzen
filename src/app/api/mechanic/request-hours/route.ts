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

  const { assignment_id, wo_number, job_description } = await req.json()
  if (!assignment_id) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 })

  // Verify assignment belongs to this mechanic + get WO ID
  const s = db()
  const { data: assign } = await s.from('wo_job_assignments').select('id, line_id, so_lines(so_id)').eq('id', assignment_id).eq('user_id', actor.id).single()
  if (!assign) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const woId = (assign.so_lines as any)?.so_id

  try {
    await notifyRole({
      shopId,
      role: ['shop_manager', 'service_writer', 'owner', 'gm'],
      title: `Hours needed: ${wo_number || 'WO'}`,
      body: `${actor.full_name || 'Mechanic'} needs book/expected hours set for: ${job_description || 'job'}. Mechanic cannot start work without hours.`,
      link: woId ? `/work-orders/${woId}` : undefined,
    })
  } catch {}

  try {
    await s.from('wo_activity_log').insert({
      wo_id: woId || null, user_id: actor.id,
      action: `Mechanic requested hours for ${wo_number || 'WO'}: ${job_description || 'job'}`,
    })
  } catch {}

  return NextResponse.json({ ok: true })
}
