import { NextResponse } from 'next/server'
import { notifyUser, notifyRole } from '@/lib/notify'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser } from '@/lib/route-guards'
import { logAction } from '@/lib/services/auditLog'

const MANAGER_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'floor_manager', 'service_manager', 'office_admin']
const MECHANIC_ROLES = ['technician', 'lead_tech', 'maintenance_technician', 'mechanic']

function canRespond(role: string) {
  return MANAGER_ROLES.includes(role)
}

export async function GET(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const mechanicId = new URL(req.url).searchParams.get('mechanic_id')
  const status = new URL(req.url).searchParams.get('status')
  if (mechanicId && mechanicId !== actor.id && !canRespond(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const s = createAdminSupabaseClient()
  let q = s.from('mechanic_action_requests')
    .select('*, users!mechanic_id(full_name), service_orders!so_id(so_number, assets(unit_number), customers(company_name))')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })

  if (mechanicId) q = q.eq('mechanic_id', mechanicId)
  else if (!canRespond(actor.role)) q = q.eq('mechanic_id', actor.id)
  if (status) q = q.eq('status', status)

  const { data, error: dbError } = await q.limit(100)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)
  const action = body?.action

  if (action === 'create') {
    if (![...MECHANIC_ROLES, ...MANAGER_ROLES].includes(actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const soId = typeof body?.so_id === 'string' ? body.so_id : ''
    const requestType = typeof body?.request_type === 'string' ? body.request_type : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    const mechanicId = canRespond(actor.role) && typeof body?.mechanic_id === 'string' ? body.mechanic_id : actor.id
    if (!soId || !mechanicId || !requestType || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: so } = await s.from('service_orders').select('id, shop_id, so_number').eq('id', soId).eq('shop_id', shopId).single()
    if (!so) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

    const { data, error: dbError } = await s.from('mechanic_action_requests').insert({
      shop_id: shopId,
      so_id: soId,
      mechanic_id: mechanicId,
      request_type: requestType,
      description,
      parts_needed: Array.isArray(body?.parts_needed) ? body.parts_needed : [],
      hours_requested: body?.hours_requested || null,
      assigned_to: requestType === 'labor_extension' ? 'accounting' : 'supervisor',
    }).select().single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    try {
      const { data: mech } = await s.from('users').select('full_name').eq('id', mechanicId).single()
      await notifyRole({
        shopId,
        role: ['shop_manager', 'service_writer', 'owner'],
        title: `Action request: ${so?.so_number} — ${requestType.replace(/_/g, ' ')}`,
        body: `${mech?.full_name || 'Technician'}: ${description.slice(0, 80)}`,
        link: '/orders?tab=requests',
      })
    } catch {}

    logAction({ shop_id: shopId, user_id: actor.id, action: 'mechanic_request.created', entity_type: 'mechanic_action_request', entity_id: data.id }).catch(() => {})
    return NextResponse.json(data, { status: 201 })
  }

  if (action === 'respond') {
    if (!canRespond(actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const requestId = typeof body?.request_id === 'string' ? body.request_id : ''
    const newStatus = typeof body?.status === 'string' ? body.status : ''
    if (!requestId || !newStatus) return NextResponse.json({ error: 'request_id and status required' }, { status: 400 })

    const { data: existing } = await s.from('mechanic_action_requests').select('id, shop_id, mechanic_id, request_type, so_id').eq('id', requestId).eq('shop_id', shopId).single()
    if (!existing) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    await s.from('mechanic_action_requests').update({
      status: newStatus,
      response_note: body?.response_note || null,
      responded_by: actor.id,
      responded_at: new Date().toISOString(),
    }).eq('id', requestId)

    try {
      const { data: reqData } = await s.from('mechanic_action_requests')
        .select('mechanic_id, shop_id, request_type, service_orders!so_id(so_number)')
        .eq('id', requestId).single() as any
      if (reqData) {
        await notifyUser({
          shopId: reqData.shop_id,
          userId: reqData.mechanic_id,
          title: `Request ${newStatus}: ${reqData.service_orders?.so_number} — ${reqData.request_type.replace(/_/g, ' ')}`,
          body: body?.response_note || (newStatus === 'approved' ? 'Your request has been approved' : 'Your request was denied'),
          link: '/mechanic/dashboard',
        })
      }
    } catch {}

    logAction({ shop_id: shopId, user_id: actor.id, action: 'mechanic_request.responded', entity_type: 'mechanic_action_request', entity_id: requestId, details: { status: newStatus } }).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  if (action === 'job_action') {
    const soId = typeof body?.so_id === 'string' ? body.so_id : ''
    const mechanicAction = typeof body?.mechanic_action === 'string' ? body.mechanic_action : ''
    if (!soId || !mechanicAction) return NextResponse.json({ error: 'so_id and mechanic_action required' }, { status: 400 })

    const { data: so } = await s.from('service_orders').select('id, shop_id, assigned_tech, so_number').eq('id', soId).eq('shop_id', shopId).single()
    if (!so) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    if (!canRespond(actor.role) && so.assigned_tech && so.assigned_tech !== actor.id) {
      return NextResponse.json({ error: 'You are not assigned to this work order' }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    if (mechanicAction === 'accept') updates.mechanic_status = 'accepted'
    else if (mechanicAction === 'start') { updates.mechanic_status = 'in_progress'; updates.status = 'in_progress'; updates.time_started = new Date().toISOString() }
    else if (mechanicAction === 'pause') { updates.mechanic_status = 'paused'; updates.time_paused = new Date().toISOString() }
    else if (mechanicAction === 'resume') { updates.mechanic_status = 'in_progress'; updates.time_paused = null }
    else if (mechanicAction === 'complete') { updates.mechanic_status = 'completed'; updates.status = 'done'; updates.completed_at = new Date().toISOString() }
    else if (mechanicAction === 'decline') {
      updates.assigned_tech = null
      updates.mechanic_status = 'not_accepted'
      try {
        await notifyRole({ shopId, role: ['shop_manager'], title: `Job declined: ${so.so_number}`, body: 'Mechanic declined the assignment', link: `/orders/${soId}` })
      } catch {}
    }

    await s.from('service_orders').update(updates).eq('id', soId).eq('shop_id', shopId)
    logAction({ shop_id: shopId, user_id: actor.id, action: `mechanic_job.${mechanicAction}`, entity_type: 'service_order', entity_id: soId }).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_progress') {
    const soId = typeof body?.so_id === 'string' ? body.so_id : ''
    const progress = Math.min(100, Math.max(0, Number(body?.progress_pct || 0)))
    if (!soId) return NextResponse.json({ error: 'so_id required' }, { status: 400 })

    const { data: so } = await s.from('service_orders').select('id, shop_id, assigned_tech').eq('id', soId).eq('shop_id', shopId).single()
    if (!so) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    if (!canRespond(actor.role) && so.assigned_tech && so.assigned_tech !== actor.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await s.from('service_orders').update({ progress_pct: progress }).eq('id', soId).eq('shop_id', shopId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
