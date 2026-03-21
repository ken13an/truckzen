import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const status = searchParams.get('status')
  const customerId = searchParams.get('customer_id')

  const supabase = db()
  let q = supabase
    .from('estimates')
    .select(`
      id, estimate_number, customer_id, customer_name, customer_email, customer_phone,
      labor_total, parts_total, subtotal, tax_amount, total, status,
      sent_at, sent_via, viewed_at, responded_at, approved_by, valid_until,
      notes, created_at, updated_at, repair_order_id,
      service_orders!estimates_repair_order_id_fkey(id, so_number, status, complaint, assets(unit_number, year, make, model))
    `)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  if (customerId) q = q.eq('customer_id', customerId)

  const { data, error } = await q.limit(200)
  if (error) {
    // Fallback without join if FK name doesn't match
    const { data: fallback, error: err2 } = await supabase
      .from('estimates')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (err2) return NextResponse.json({ error: err2.message }, { status: 500 })
    return NextResponse.json(fallback)
  }
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { shop_id, repair_order_id, customer_id, customer_name, customer_email, customer_phone, lines, notes } = body

  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const supabase = db()

  // Get shop tax rate
  const { data: shop } = await supabase.from('shops').select('tax_rate').eq('id', shop_id).single()
  const taxRate = shop?.tax_rate || 0

  // Calculate totals
  const laborTotal = (lines || []).reduce((s: number, l: any) => s + (parseFloat(l.labor_total) || 0), 0)
  const partsTotal = (lines || []).reduce((s: number, l: any) => s + (parseFloat(l.parts_total) || 0), 0)
  const subtotal = laborTotal + partsTotal
  const taxAmount = Math.round(subtotal * taxRate) / 100
  const total = subtotal + taxAmount

  // Generate estimate number
  const { count } = await supabase.from('estimates').select('id', { count: 'exact', head: true }).eq('shop_id', shop_id)
  const estimateNumber = `EST-${String((count || 0) + 1).padStart(5, '0')}`

  // Generate approval token
  const approvalToken = crypto.randomUUID()

  const { data: estimate, error } = await supabase.from('estimates').insert({
    shop_id,
    repair_order_id: repair_order_id || null,
    estimate_number: estimateNumber,
    customer_id: customer_id || null,
    customer_name: customer_name || null,
    customer_email: customer_email || null,
    customer_phone: customer_phone || null,
    labor_total: laborTotal,
    parts_total: partsTotal,
    subtotal,
    tax_amount: taxAmount,
    total,
    status: 'draft',
    approval_token: approvalToken,
    notes: notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert estimate lines
  if (lines && lines.length > 0) {
    const lineRows = lines.map((l: any, i: number) => ({
      estimate_id: estimate.id,
      repair_order_line_id: l.repair_order_line_id || null,
      description: l.description || '',
      complaint: l.complaint || null,
      labor_hours: parseFloat(l.labor_hours) || 0,
      labor_rate: parseFloat(l.labor_rate) || 0,
      labor_total: parseFloat(l.labor_total) || 0,
      parts_total: parseFloat(l.parts_total) || 0,
      line_total: parseFloat(l.line_total) || 0,
      is_approved: null,
      customer_response: null,
      line_number: i + 1,
    }))
    const { error: lineErr } = await supabase.from('estimate_lines').insert(lineRows)
    if (lineErr) console.error('[Estimates] Line insert error:', lineErr.message)
  }

  return NextResponse.json(estimate, { status: 201 })
}
