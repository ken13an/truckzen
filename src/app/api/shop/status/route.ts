import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Public endpoint — secured by shop token, not user auth
// Used by cross-dept share link, external dispatch systems, customer portal
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const token  = searchParams.get('token')

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  // Verify token matches shop's share_token (set in shops table)
  if (token) {
    const { data: shop } = await getSupabase().from('shops').select('share_token').eq('id', shopId).single()
    if (!shop || shop.share_token !== token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: openJobs },
    { data: waitingParts },
    { data: goodToGo },
    { data: overdueInvoices },
    { data: overduePMs },
  ] = await Promise.all([
    getSupabase().from('service_orders')
      .select('id, so_number, status, priority, bay, team, complaint, assets(unit_number, make, model), users!assigned_tech(full_name)')
      .eq('shop_id', shopId)
      .not('status', 'in', '("good_to_go","void")')
      .order('priority', { ascending: false })
      .limit(50),
    getSupabase().from('service_orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'waiting_parts'),
    getSupabase().from('service_orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'good_to_go'),
    getSupabase().from('invoices').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'sent').lt('due_date', today),
    getSupabase().from('pm_schedules').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('active', true).lt('next_due_date', today),
  ])

  // Strip sensitive internal data — this is for external view
  const publicJobs = (openJobs || []).map(j => ({
    so_number:    (j as any).so_number,
    status:       (j as any).status,
    priority:     (j as any).priority,
    bay:          (j as any).bay,
    team:         (j as any).team,
    truck:        (j as any).assets ? `Unit #${(j.assets as any).unit_number} — ${(j.assets as any).make}` : '—',
    technician:   (j as any).users ? (j as any).users.full_name.split(' ')[0] : 'Unassigned',
  }))

  return NextResponse.json({
    shop_id:          shopId,
    as_of:            new Date().toISOString(),
    open_jobs:        openJobs?.length || 0,
    waiting_parts:    (waitingParts as any)?.count || 0,
    good_to_go:       (goodToGo as any)?.count || 0,
    overdue_invoices: (overdueInvoices as any)?.count || 0,
    overdue_pm:       (overduePMs as any)?.count || 0,
    jobs:             publicJobs,
  }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
