import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyRole } from '@/lib/notify'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const supabase = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })

  const status = searchParams.get('status')
  const team = searchParams.get('team')
  const role = searchParams.get('role') ?? ''
  const userTeam = searchParams.get('user_team') ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  let q = supabase
    .from('service_orders')
    .select(`
      id, so_number, status, priority, complaint, bay, team,
      grand_total, created_at, updated_at,
      assets(id, unit_number, year, make, model),
      customers(id, company_name),
      users!assigned_tech(id, full_name)
    `)
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .not('status', 'eq', 'void')
    .order('created_at', { ascending: false })
    .limit(limit)

  const limitedRoles = ['technician', 'maintenance_technician']
  if (limitedRoles.includes(role) && userTeam) q = q.eq('team', userTeam)
  if (status) q = q.eq('status', status)
  if (team && !limitedRoles.includes(role)) q = q.eq('team', team)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = db()

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { shop_id, user_id, role, asset_id, customer_id, complaint, cause, correction, source, priority, team, bay } = body

  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!asset_id) return NextResponse.json({ error: 'Select a truck' }, { status: 400 })
  if (!complaint || complaint.trim().length === 0) return NextResponse.json({ error: 'Describe the complaint' }, { status: 400 })

  // Check can_create_so permission
  if (user_id) {
    const { data: userRecord } = await supabase.from('users').select('role, can_create_so').eq('id', user_id).single()
    if (userRecord) {
      const canCreate = ['owner', 'gm', 'it_person', 'service_writer', 'shop_manager', 'office_admin'].includes(userRecord.role) || userRecord.can_create_so === true
      if (!canCreate) return NextResponse.json({ error: 'You do not have permission to create service orders' }, { status: 403 })
    }
  }

  // Generate SO number
  const { count } = await supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop_id).is('deleted_at', null)
  const year = new Date().getFullYear()
  const soNum = `SO-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data: so, error } = await supabase
    .from('service_orders')
    .insert({
      shop_id: shop_id,
      so_number: soNum,
      asset_id: asset_id,
      customer_id: customer_id || null,
      complaint: complaint.trim(),
      cause: cause || null,
      correction: correction || null,
      source: source || 'walk_in',
      priority: priority || 'normal',
      team: team || null,
      bay: bay || null,
      status: 'draft',
      advisor_id: user_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify floor supervisors
  try {
    const { data: asset } = await supabase.from('assets').select('unit_number').eq('id', asset_id).single()
    const unitNum = asset?.unit_number || '?'
    await notifyRole({
      shopId: shop_id,
      role: ['shop_manager', 'maintenance_manager'],
      title: `New ${soNum} — Truck #${unitNum}`,
      body: complaint.trim().slice(0, 100),
      link: `/orders/${so.id}`,
    })
  } catch {}

  return NextResponse.json(so, { status: 201 })
}
