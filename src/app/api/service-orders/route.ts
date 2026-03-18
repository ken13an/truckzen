import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { checkRateLimit, schemas, securityMiddleware } from '@/lib/security'
import { log } from '@/lib/security'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user     = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const team   = searchParams.get('team')
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  let q = supabase
    .from('service_orders')
    .select(`
      id, so_number, status, priority, complaint, bay, team,
      grand_total, created_at, updated_at,
      assets(id, unit_number, year, make, model),
      customers(id, company_name),
      users!assigned_tech(id, full_name)
    `)
    .eq('shop_id', user.shop_id)
    .not('status', 'eq', 'void')
    .order('created_at', { ascending: false })
    .limit(limit)

  // Techs only see their team
  const limitedRoles = ['technician', 'maintenance_technician']
  if (limitedRoles.includes(user.role) && user.team) {
    q = q.eq('team', user.team)
  }
  if (status) q = q.eq('status', status)
  if (team && !limitedRoles.includes(user.role)) q = q.eq('team', team)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user     = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only these roles can create SOs
  const allowed = ['owner','gm','it_person','shop_manager','service_advisor','service_writer','office_admin']
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const ip    = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const check = await checkRateLimit('api', `${user.id}:${ip}`)
  if (!check.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validated = schemas.serviceOrder.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.issues.map(i => i.message).join(', ') }, { status: 400 })
  }

  const data = validated.data

  // Generate SO number: SO-YYYY-NNNN
  const { count } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', user.shop_id)

  const year   = new Date().getFullYear()
  const soNum  = `SO-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data: so, error } = await supabase
    .from('service_orders')
    .insert({
      shop_id:    user.shop_id,
      so_number:  soNum,
      asset_id:   data.asset_id,
      customer_id:data.customer_id ?? null,
      complaint:  data.complaint,
      source:     data.source,
      priority:   data.priority,
      team:       data.team ?? null,
      bay:        data.bay ?? null,
      status:     'not_started',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await log('so.created', user.shop_id, user.id, {
    table: 'service_orders', recordId: so.id,
    newData: { so_number: soNum, complaint: data.complaint },
  })

  return NextResponse.json(so, { status: 201 })
}
