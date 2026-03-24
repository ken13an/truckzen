import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET — fetch assignments for a line or all lines of a WO
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const lineId = searchParams.get('line_id')
  const woId = searchParams.get('wo_id')

  if (lineId) {
    const { data } = await s.from('wo_job_assignments').select('*, users(id, full_name, team)').eq('line_id', lineId).order('created_at').limit(100)
    return NextResponse.json(data || [])
  }

  if (woId) {
    // Get all line IDs for this WO, then all assignments
    const { data: lines } = await s.from('so_lines').select('id').eq('so_id', woId)
    if (!lines || lines.length === 0) return NextResponse.json([])
    const lineIds = lines.map(l => l.id)
    const { data } = await s.from('wo_job_assignments').select('*, users(id, full_name, team)').in('line_id', lineIds).order('created_at').limit(500)
    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: 'line_id or wo_id required' }, { status: 400 })
}

// POST — save assignments for a line (replaces all existing)
export async function POST(req: Request) {
  const s = db()
  const { line_id, assignments, wo_id, user_id } = await req.json()

  if (!line_id || !Array.isArray(assignments)) {
    return NextResponse.json({ error: 'line_id and assignments[] required' }, { status: 400 })
  }

  // Delete existing assignments for this line
  await s.from('wo_job_assignments').delete().eq('line_id', line_id)

  // Insert new assignments
  if (assignments.length > 0) {
    const rows = assignments.filter((a: any) => a.user_id).map((a: any) => ({
      line_id,
      user_id: a.user_id,
      percentage: a.percentage || 100,
    }))
    if (rows.length > 0) {
      const { error } = await s.from('wo_job_assignments').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also update the legacy assigned_to field with the first mechanic
    await s.from('so_lines').update({ assigned_to: rows[0].user_id, line_status: 'in_progress' }).eq('id', line_id)
  } else {
    await s.from('so_lines').update({ assigned_to: null, line_status: 'unassigned' }).eq('id', line_id)
  }

  // Log activity
  if (wo_id && user_id) {
    const names = assignments.map((a: any) => `${a.name || 'Mechanic'} (${a.percentage || 100}%)`).join(', ')
    await s.from('wo_activity_log').insert({
      wo_id,
      user_id,
      action: assignments.length > 0 ? `Assigned mechanics: ${names}` : 'Unassigned all mechanics',
    })
  }

  // Notify assigned mechanics
  if (assignments.length > 0 && wo_id) {
    try {
      const { createNotification } = await import('@/lib/createNotification')
      const { data: wo } = await s.from('service_orders').select('so_number, shop_id, assets(unit_number)').eq('id', wo_id).single()
      if (wo) {
        const mechIds = assignments.filter((a: any) => a.user_id).map((a: any) => a.user_id)
        const unitNum = (wo.assets as any)?.unit_number || ''
        await createNotification({
          shopId: wo.shop_id, recipientId: mechIds, type: 'job_assigned',
          title: 'New Job Assigned', body: `You've been assigned to ${wo.so_number} #${unitNum}`,
          link: `/work-orders/${wo_id}`, relatedWoId: wo_id, relatedUnit: unitNum,
        })
      }
    } catch {}
  }

  return NextResponse.json({ ok: true })
}

// DELETE — remove a single assignment
export async function DELETE(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await s.from('wo_job_assignments').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
