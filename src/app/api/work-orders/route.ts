import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const status = searchParams.get('status')
  const search = searchParams.get('q')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)

  let q = s
    .from('service_orders')
    .select(`
      id, so_number, status, priority, complaint, bay, team,
      grand_total, created_at, updated_at, assigned_tech,
      assets(id, unit_number, year, make, model),
      customers(id, company_name),
      users!assigned_tech(id, full_name)
    `)
    .eq('shop_id', shopId)
    .not('status', 'eq', 'void')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let results = data || []
  if (search) {
    const sq = search.toLowerCase()
    results = results.filter((r: any) =>
      r.so_number?.toLowerCase().includes(sq) ||
      r.complaint?.toLowerCase().includes(sq) ||
      (r.customers as any)?.company_name?.toLowerCase().includes(sq) ||
      (r.assets as any)?.unit_number?.toLowerCase().includes(sq)
    )
  }

  return NextResponse.json(results)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { shop_id, user_id, asset_id, customer_id, complaint, priority, job_lines } = body

  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!complaint?.trim()) return NextResponse.json({ error: 'Concern description required' }, { status: 400 })

  // Generate WO number
  const { count } = await s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop_id)
  const year = new Date().getFullYear()
  const woNum = `WO-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data: wo, error } = await s
    .from('service_orders')
    .insert({
      shop_id,
      so_number: woNum,
      asset_id: asset_id || null,
      customer_id: customer_id || null,
      complaint: complaint.trim(),
      source: 'walk_in',
      priority: priority || 'normal',
      status: 'draft',
      advisor_id: user_id || null,
      service_writer_id: user_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create job lines
  const lines = job_lines || [complaint.trim()]
  for (let i = 0; i < lines.length; i++) {
    const lineText = typeof lines[i] === 'string' ? lines[i] : lines[i].description
    if (!lineText?.trim()) continue
    await s.from('so_lines').insert({
      so_id: wo.id,
      line_type: 'labor',
      description: lineText.trim(),
      quantity: 0,
      unit_price: 0,
      total_price: 0,
      line_status: 'unassigned',
    })
  }

  // Log activity
  await s.from('wo_activity_log').insert({
    wo_id: wo.id,
    user_id: user_id || null,
    action: `Created work order ${woNum}`,
  })

  return NextResponse.json(wo, { status: 201 })
}
