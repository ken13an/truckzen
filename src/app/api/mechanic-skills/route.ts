/**
 * TruckZen — Original Design
 * Mechanic skills CRUD + auto-suggest scoring API
 */
import { NextResponse } from 'next/server'
import { scoreMechanics } from '@/lib/mechanic-skills'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

const SKILL_ADMIN_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'floor_manager', 'floor_supervisor', 'maintenance_manager', 'office_admin']

function canManageSkills(role: string) {
  return SKILL_ADMIN_ROLES.includes(role)
}

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.shop_id) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const requestedUserId = searchParams.get('user_id')
  const type = searchParams.get('type') || 'list'

  if (type === 'list') {
    let q = s.from('mechanic_skills').select('*').eq('shop_id', actor.shop_id).order('skill_category').order('skill_name')
    if (requestedUserId) q = q.eq('user_id', requestedUserId)
    const { data, error } = await q
    if (error) return jsonError(error.message, 500)
    return NextResponse.json(data || [])
  }

  if (type === 'suggest') {
    const jobDescription = searchParams.get('job_description') || ''
    if (!jobDescription) return jsonError('job_description required', 400)

    const { data: mechanics } = await s.from('users').select('id, full_name')
      .eq('shop_id', actor.shop_id).in('role', ['technician', 'lead_tech', 'maintenance_technician']).eq('active', true).is('deleted_at', null).or('is_autobot.is.null,is_autobot.eq.false')
    const { data: skills } = await s.from('mechanic_skills').select('user_id, skill_name, skill_category, experience_level, certified').eq('shop_id', actor.shop_id)
    const { data: clocks } = await s.from('time_entries').select('user_id').eq('shop_id', actor.shop_id).is('clock_out', null)
    const { data: assigned } = await s.from('service_orders').select('assigned_tech')
      .eq('shop_id', actor.shop_id).is('deleted_at', null).not('status', 'in', '("done","good_to_go","void")').not('assigned_tech', 'is', null)

    const jobQueues: Record<string, number> = {}
    for (const wo of assigned || []) {
      jobQueues[(wo as any).assigned_tech] = (jobQueues[(wo as any).assigned_tech] || 0) + 1
    }

    const scores = scoreMechanics(jobDescription, mechanics || [], skills || [], clocks || [], jobQueues)
    return NextResponse.json(scores)
  }

  return jsonError('Invalid type', 400)
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.shop_id) return jsonError('No shop context', 400)
  if (!canManageSkills(actor.role)) return jsonError('Forbidden', 403)

  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)
  const { action, user_id, ...data } = body || {}

  if (action === 'add') {
    const { skill_name, skill_category, experience_level, certified } = data
    if (!skill_name || !skill_category || !user_id) return jsonError('skill_name, skill_category, user_id required', 400)
    const { data: userRow } = await s.from('users').select('shop_id').eq('id', user_id).single()
    if (!userRow || userRow.shop_id !== actor.shop_id) return jsonError('Invalid user', 403)
    const { data: skill, error } = await s.from('mechanic_skills').upsert({
      shop_id: actor.shop_id, user_id, skill_name, skill_category,
      experience_level: experience_level || 'intermediate',
      certified: certified || false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id,user_id,skill_name' }).select().single()
    if (error) return jsonError(error.message, 500)
    return NextResponse.json(skill)
  }

  if (action === 'bulk_add') {
    const { skills, user_ids } = data
    if (!skills?.length || !user_ids?.length) return jsonError('skills and user_ids required', 400)
    const { data: validUsers } = await s.from('users').select('id').eq('shop_id', actor.shop_id).in('id', user_ids)
    const validUserIds = new Set((validUsers || []).map((u: any) => u.id))
    if (validUserIds.size !== user_ids.length) return jsonError('One or more users are invalid', 403)

    const rows = []
    for (const uid of user_ids) {
      for (const sk of skills) {
        rows.push({
          shop_id: actor.shop_id, user_id: uid, skill_name: sk.name || sk.skill_name,
          skill_category: sk.category || sk.skill_category,
          experience_level: sk.level || sk.experience_level || 'intermediate',
          certified: sk.certified || false,
          updated_at: new Date().toISOString(),
        })
      }
    }
    const { error } = await s.from('mechanic_skills').upsert(rows, { onConflict: 'shop_id,user_id,skill_name' })
    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ ok: true, count: rows.length })
  }

  if (action === 'update') {
    const { id, experience_level, certified } = data
    if (!id) return jsonError('id required', 400)
    const { data: existing } = await s.from('mechanic_skills').select('id, shop_id').eq('id', id).single()
    if (!existing || existing.shop_id !== actor.shop_id) return jsonError('Skill not found', 404)
    const { error } = await s.from('mechanic_skills').update({
      experience_level, certified, updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    const { id } = data
    if (!id) return jsonError('id required', 400)
    const { data: existing } = await s.from('mechanic_skills').select('id, shop_id').eq('id', id).single()
    if (!existing || existing.shop_id !== actor.shop_id) return jsonError('Skill not found', 404)
    const { error } = await s.from('mechanic_skills').delete().eq('id', id)
    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ ok: true })
  }

  return jsonError('Invalid action', 400)
}
