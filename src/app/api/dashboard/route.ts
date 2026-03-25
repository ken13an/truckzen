import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: user } = await s.from('users').select('id, full_name, role, shop_id, team').eq('id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const shopId = user.shop_id
  const role = user.role
  const today = new Date().toISOString().split('T')[0]

  // Notifications — unread for this user
  const { data: notifications } = await s.from('notifications').select('id, title, body, link, type, priority, created_at')
    .eq('user_id', userId).eq('read', false).eq('is_dismissed', false)
    .order('created_at', { ascending: false }).limit(20)

  // Recent activity — last 10 from wo_activity_log
  const { data: activity } = await s.from('wo_activity_log').select('id, user_id, action, created_at, wo_id')
    .eq('shop_id', shopId).order('created_at', { ascending: false }).limit(10)

  let stats: any = {}
  let actionItems: any[] = []
  let teamStatus: any = null

  // ---- SERVICE WRITER ----
  if (['service_writer', 'service_advisor'].includes(role)) {
    const [openWos, estPending, estApprovedToday, invoiceReview] = await Promise.all([
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null).not('status', 'in', '("good_to_go","done","void")').not('so_number', 'like', 'DRAFT-%'),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('estimate_required', true).eq('estimate_approved', false).is('deleted_at', null).not('status', 'in', '("good_to_go","done","void")').not('so_number', 'like', 'DRAFT-%'),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('estimate_approved', true).gte('updated_at', today),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('invoice_status', 'pending_review').is('deleted_at', null),
    ])
    stats = { open_wos: openWos.count || 0, estimates_pending: estPending.count || 0, estimates_approved_today: estApprovedToday.count || 0, invoices_to_review: invoiceReview.count || 0 }

    // Action items: WOs needing estimate
    const { data: needEst } = await s.from('service_orders').select('id, so_number, complaint, ownership_type, assets(unit_number)')
      .eq('shop_id', shopId).eq('estimate_required', true).eq('estimate_approved', false).is('deleted_at', null)
      .not('status', 'in', '("good_to_go","done","void")').order('created_at', { ascending: false }).limit(10)
    actionItems = (needEst || []).map((wo: any) => ({
      id: wo.id, title: 'Build Estimate', description: wo.complaint?.slice(0, 60),
      wo_number: wo.so_number, unit: (wo.assets as any)?.unit_number,
      link: `/work-orders/${wo.id}`, priority: 'high', action: 'Build Estimate',
    }))
  }

  // ---- FLOOR MANAGER / SHOP MANAGER ----
  if (['shop_manager', 'floor_manager'].includes(role)) {
    const [inProgress, unassigned, partsWait, mechsActive] = await Promise.all([
      s.from('so_lines').select('*', { count: 'exact', head: true }).eq('line_status', 'in_progress'),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null).is('assigned_tech', null).not('status', 'in', '("good_to_go","done","void","draft")'),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'waiting_parts').is('deleted_at', null),
      s.from('users').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).in('role', ['technician', 'lead_tech', 'maintenance_technician']).or('is_autobot.is.null,is_autobot.eq.false'),
    ])
    stats = { jobs_in_progress: inProgress.count || 0, jobs_unassigned: unassigned.count || 0, parts_waiting: partsWait.count || 0, mechanics_active: mechsActive.count || 0 }

    // Action: unassigned WOs
    const { data: unassignedWos } = await s.from('service_orders').select('id, so_number, complaint, assets(unit_number)')
      .eq('shop_id', shopId).is('deleted_at', null).is('assigned_tech', null)
      .not('status', 'in', '("good_to_go","done","void","draft")').order('created_at', { ascending: false }).limit(10)
    actionItems = (unassignedWos || []).map((wo: any) => ({
      id: wo.id, title: 'Assign Mechanic', description: wo.complaint?.slice(0, 60),
      wo_number: wo.so_number, unit: (wo.assets as any)?.unit_number,
      link: `/work-orders/${wo.id}`, priority: 'normal', action: 'Assign',
    }))

    // Team status
    const { data: mechs } = await s.from('users').select('id, full_name, team')
      .eq('shop_id', shopId).in('role', ['technician', 'lead_tech', 'maintenance_technician']).or('is_autobot.is.null,is_autobot.eq.false')
    teamStatus = mechs || []
  }

  // ---- PARTS ----
  if (['parts_manager'].includes(role)) {
    const [pending, inProg, lowStock, ordered] = await Promise.all([
      s.from('wo_parts').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'pending'),
      s.from('wo_parts').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'in_progress'),
      s.from('parts').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null).lte('on_hand', 2),
      s.from('wo_parts').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'ordered'),
    ])
    stats = { pending_requests: pending.count || 0, in_progress_requests: inProg.count || 0, low_stock_parts: lowStock.count || 0, ordered_parts: ordered.count || 0 }

    const { data: pendingParts } = await s.from('wo_parts').select('id, description, part_number, wo_id, status')
      .eq('shop_id', shopId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10)
    actionItems = (pendingParts || []).map((p: any) => ({
      id: p.id, title: 'Fulfill Parts Request', description: `${p.description} ${p.part_number || ''}`,
      link: `/parts/queue`, priority: 'normal', action: 'View Request',
    }))
  }

  // ---- MECHANIC ----
  if (['technician', 'lead_tech', 'maintenance_technician'].includes(role)) {
    const [myJobs, completedToday, partsReady] = await Promise.all([
      s.from('wo_job_assignments').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['assigned', 'in_progress']),
      s.from('wo_job_assignments').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed').gte('updated_at', today),
      s.from('wo_parts').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'ready'),
    ])
    stats = { my_active_jobs: myJobs.count || 0, jobs_completed_today: completedToday.count || 0, parts_ready_for_pickup: partsReady.count || 0 }
  }

  // ---- ACCOUNTING ----
  if (['accountant'].includes(role)) {
    const [pendingApproval, sent, paidToday, revToday] = await Promise.all([
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('invoice_status', 'pending_accounting').is('deleted_at', null),
      s.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'sent'),
      s.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'paid').gte('updated_at', today),
      s.from('invoices').select('amount_paid').eq('shop_id', shopId).gte('updated_at', today),
    ])
    const revenue = (revToday.data || []).reduce((sum: number, i: any) => sum + (i.amount_paid || 0), 0)
    stats = { invoices_pending_approval: pendingApproval.count || 0, invoices_sent: sent.count || 0, payments_received_today: paidToday.count || 0, revenue_today: revenue }

    const { data: pendInv } = await s.from('service_orders').select('id, so_number, grand_total, assets(unit_number), customers(company_name)')
      .eq('shop_id', shopId).eq('invoice_status', 'pending_accounting').is('deleted_at', null).order('updated_at', { ascending: false }).limit(10)
    actionItems = (pendInv || []).map((wo: any) => ({
      id: wo.id, title: 'Review Invoice', description: `${(wo.customers as any)?.company_name || ''} · $${(wo.grand_total || 0).toFixed(0)}`,
      wo_number: wo.so_number, unit: (wo.assets as any)?.unit_number,
      link: `/work-orders/${wo.id}`, priority: 'normal', action: 'Review',
    }))
  }

  // ---- OWNER / ADMIN / GM ----
  if (['owner', 'gm', 'it_person', 'office_admin'].includes(role)) {
    const [openWos, revToday, activeMechs, pendEst] = await Promise.all([
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null).not('status', 'in', '("good_to_go","done","void")'),
      s.from('invoices').select('amount_paid').eq('shop_id', shopId).gte('updated_at', today),
      s.from('users').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).in('role', ['technician', 'lead_tech', 'maintenance_technician']).or('is_autobot.is.null,is_autobot.eq.false'),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('estimate_required', true).eq('estimate_approved', false).is('deleted_at', null).not('status', 'in', '("good_to_go","done","void")'),
    ])
    const revenue = (revToday.data || []).reduce((sum: number, i: any) => sum + (i.amount_paid || 0), 0)
    stats = { open_wos: openWos.count || 0, revenue_today: revenue, active_mechanics: activeMechs.count || 0, pending_estimates: pendEst.count || 0 }

    // All-shop notifications for admins
    const { data: allNotifs } = await s.from('notifications').select('id, title, body, link, type, priority, created_at')
      .eq('shop_id', shopId).eq('read', false).eq('is_dismissed', false)
      .order('created_at', { ascending: false }).limit(20)

    return NextResponse.json({
      role, user: { id: user.id, full_name: user.full_name, role: user.role },
      notifications: allNotifs || [],
      stats, actionItems, teamStatus,
      recentActivity: activity || [],
    })
  }

  return NextResponse.json({
    role, user: { id: user.id, full_name: user.full_name, role: user.role },
    notifications: notifications || [],
    stats, actionItems, teamStatus,
    recentActivity: activity || [],
  })
}
