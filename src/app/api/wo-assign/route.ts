import { ASSIGNMENT_ROLES } from '@/lib/roles'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const ASSIGN_ROLES = [...ASSIGNMENT_ROLES]

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ASSIGN_ROLES.includes(actor.role)) return jsonError('Access denied', 403)

  const s = db()
  const body = await req.json()
  const { line_id, tech_id, wo_id } = body

  if (!line_id || !wo_id)
    return NextResponse.json({ error: 'line_id and wo_id required' }, { status: 400 })

  // Verify WO belongs to actor's shop
  const { data: wo } = await s.from('service_orders').select('id').eq('id', wo_id).eq('shop_id', shopId).single()
  if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

  // Update the so_line assignment
  const newStatus = tech_id ? 'in_progress' : 'unassigned'
  const { data, error } = await s
    .from('so_lines')
    .update({ assigned_to: tech_id || null, line_status: newStatus })
    .eq('id', line_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build activity log message
  let actionText: string
  if (tech_id) {
    const { data: tech } = await s.from('users').select('full_name').eq('id', tech_id).single()
    actionText = `Assigned job to ${tech?.full_name || 'Unknown'}`
  } else {
    actionText = 'Unassigned job'
  }

  await s.from('wo_activity_log').insert({
    wo_id,
    user_id: actor.id,
    action: actionText,
  })

  return NextResponse.json(data)
}
