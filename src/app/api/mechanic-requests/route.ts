import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser, notifyRole } from '@/lib/notify'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const mechanicId = searchParams.get('mechanic_id')
  const status = searchParams.get('status')

  let q = s.from('mechanic_action_requests')
    .select('*, users!mechanic_id(full_name), service_orders!so_id(so_number, assets(unit_number), customers(company_name))')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })

  if (mechanicId) q = q.eq('mechanic_id', mechanicId)
  if (status) q = q.eq('status', status)

  const { data, error } = await q.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { action } = body

  if (action === 'create') {
    const { shop_id, so_id, mechanic_id, request_type, description, parts_needed, hours_requested } = body
    if (!shop_id || !so_id || !mechanic_id || !request_type || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await s.from('mechanic_action_requests').insert({
      shop_id, so_id, mechanic_id, request_type, description,
      parts_needed: parts_needed || [], hours_requested: hours_requested || null,
      assigned_to: request_type === 'labor_extension' ? 'accounting' : 'supervisor',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify supervisor/writer
    try {
      const { data: so } = await s.from('service_orders').select('so_number, assets(unit_number)').eq('id', so_id).single()
      const { data: mech } = await s.from('users').select('full_name').eq('id', mechanic_id).single()
      await notifyRole({
        shopId: shop_id,
        role: ['shop_manager', 'service_writer', 'owner'],
        title: `Action request: ${so?.so_number} — ${request_type.replace(/_/g, ' ')}`,
        body: `${mech?.full_name}: ${description.slice(0, 80)}`,
        link: '/orders?tab=requests',
      })
    } catch {}

    return NextResponse.json(data, { status: 201 })
  }

  if (action === 'respond') {
    const { request_id, status: newStatus, response_note, responded_by } = body
    if (!request_id || !newStatus) return NextResponse.json({ error: 'request_id and status required' }, { status: 400 })

    await s.from('mechanic_action_requests').update({
      status: newStatus, response_note: response_note || null,
      responded_by: responded_by || null, responded_at: new Date().toISOString(),
    }).eq('id', request_id)

    // Notify mechanic
    try {
      const { data: req } = await s.from('mechanic_action_requests')
        .select('mechanic_id, shop_id, request_type, service_orders!so_id(so_number)')
        .eq('id', request_id).single() as any
      if (req) {
        await notifyUser({
          shopId: req.shop_id, userId: req.mechanic_id,
          title: `Request ${newStatus}: ${req.service_orders?.so_number} — ${req.request_type.replace(/_/g, ' ')}`,
          body: response_note || (newStatus === 'approved' ? 'Your request has been approved' : 'Your request was denied'),
          link: '/tech',
        })
      }
    } catch {}

    return NextResponse.json({ ok: true })
  }

  // Mechanic job actions: accept, start, pause, resume, complete, decline
  if (action === 'job_action') {
    const { so_id, mechanic_action, mechanic_id } = body
    if (!so_id || !mechanic_action) return NextResponse.json({ error: 'so_id and mechanic_action required' }, { status: 400 })

    const updates: any = {}
    if (mechanic_action === 'accept') { updates.mechanic_status = 'accepted' }
    else if (mechanic_action === 'start') { updates.mechanic_status = 'in_progress'; updates.status = 'in_progress'; updates.time_started = new Date().toISOString() }
    else if (mechanic_action === 'pause') { updates.mechanic_status = 'paused'; updates.time_paused = new Date().toISOString() }
    else if (mechanic_action === 'resume') { updates.mechanic_status = 'in_progress'; updates.time_paused = null }
    else if (mechanic_action === 'complete') { updates.mechanic_status = 'completed'; updates.status = 'done'; updates.completed_at = new Date().toISOString() }
    else if (mechanic_action === 'decline') {
      updates.assigned_tech = null; updates.mechanic_status = 'not_accepted'
      // Notify supervisor
      try {
        const { data: so } = await s.from('service_orders').select('shop_id, so_number').eq('id', so_id).single()
        if (so) await notifyRole({ shopId: so.shop_id, role: ['shop_manager'], title: `Job declined: ${so.so_number}`, body: 'Mechanic declined the assignment', link: `/orders/${so_id}` })
      } catch {}
    }

    await s.from('service_orders').update(updates).eq('id', so_id)
    return NextResponse.json({ ok: true })
  }

  // Update progress
  if (action === 'update_progress') {
    const { so_id, progress_pct } = body
    await s.from('service_orders').update({ progress_pct: Math.min(100, Math.max(0, progress_pct || 0)) }).eq('id', so_id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
