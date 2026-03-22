/**
 * TruckZen — Original Design
 * Mechanic skills CRUD + auto-suggest scoring API
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scoreMechanics } from '@/lib/mechanic-skills'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const userId = searchParams.get('user_id')
  const type = searchParams.get('type') || 'list'

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  // List skills for a user or all users
  if (type === 'list') {
    let q = s.from('mechanic_skills').select('*').eq('shop_id', shopId).order('skill_category').order('skill_name')
    if (userId) q = q.eq('user_id', userId)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  // Auto-suggest mechanic for a job
  if (type === 'suggest') {
    const jobDescription = searchParams.get('job_description') || ''
    if (!jobDescription) return NextResponse.json({ error: 'job_description required' }, { status: 400 })

    // Get all mechanics
    const { data: mechanics } = await s.from('users').select('id, full_name')
      .eq('shop_id', shopId).in('role', ['technician', 'lead_tech', 'maintenance_technician']).eq('active', true)
    // Get all skills
    const { data: skills } = await s.from('mechanic_skills').select('user_id, skill_name, skill_category, experience_level, certified').eq('shop_id', shopId)
    // Get active clocks
    const { data: clocks } = await s.from('time_entries').select('user_id').eq('shop_id', shopId).is('clock_out', null)
    // Get job queues (assigned WOs not done)
    const { data: assigned } = await s.from('service_orders').select('assigned_tech')
      .eq('shop_id', shopId).not('status', 'in', '("done","good_to_go","void")').not('assigned_tech', 'is', null)

    const jobQueues: Record<string, number> = {}
    for (const wo of assigned || []) {
      jobQueues[wo.assigned_tech] = (jobQueues[wo.assigned_tech] || 0) + 1
    }

    const scores = scoreMechanics(jobDescription, mechanics || [], skills || [], clocks || [], jobQueues)
    return NextResponse.json(scores)
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { action, shop_id, user_id, ...data } = body

  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  // Add single skill
  if (action === 'add') {
    const { skill_name, skill_category, experience_level, certified } = data
    if (!skill_name || !skill_category || !user_id) return NextResponse.json({ error: 'skill_name, skill_category, user_id required' }, { status: 400 })
    const { data: skill, error } = await s.from('mechanic_skills').upsert({
      shop_id, user_id, skill_name, skill_category,
      experience_level: experience_level || 'intermediate',
      certified: certified || false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id,user_id,skill_name' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(skill)
  }

  // Bulk add skills
  if (action === 'bulk_add') {
    const { skills, user_ids } = data // skills: [{skill_name, skill_category, experience_level, certified}], user_ids: string[]
    if (!skills?.length || !user_ids?.length) return NextResponse.json({ error: 'skills and user_ids required' }, { status: 400 })
    const rows = []
    for (const uid of user_ids) {
      for (const sk of skills) {
        rows.push({
          shop_id, user_id: uid, skill_name: sk.name || sk.skill_name,
          skill_category: sk.category || sk.skill_category,
          experience_level: sk.level || sk.experience_level || 'intermediate',
          certified: sk.certified || false,
          updated_at: new Date().toISOString(),
        })
      }
    }
    const { error } = await s.from('mechanic_skills').upsert(rows, { onConflict: 'shop_id,user_id,skill_name' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, count: rows.length })
  }

  // Update skill
  if (action === 'update') {
    const { id, experience_level, certified } = data
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await s.from('mechanic_skills').update({
      experience_level, certified, updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Delete skill
  if (action === 'delete') {
    const { id } = data
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await s.from('mechanic_skills').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
