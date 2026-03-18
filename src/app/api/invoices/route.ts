import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { log } from '@/lib/security'

// ── GET list + POST create ────────────────────────────────────
export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','service_advisor','accountant','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let q = supabase
    .from('invoices')
    .select('id, invoice_number, status, subtotal, tax_amount, total, balance_due, amount_paid, due_date, paid_at, created_at, customers(company_name), service_orders(so_number, assets(unit_number))')
    .eq('shop_id', user.shop_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','service_advisor','accountant','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const { so_id, customer_id, due_date, tax_rate, notes } = body
  if (!so_id) return NextResponse.json({ error: 'so_id required' }, { status: 400 })

  // Fetch SO and line items
  const { data: so } = await supabase
    .from('service_orders')
    .select('id, so_number, customer_id, so_lines(line_type, description, quantity, unit_price, total_price)')
    .eq('id', so_id)
    .single()

  if (!so) return NextResponse.json({ error: 'Service order not found' }, { status: 404 })

  const lines = (so as any).so_lines || []
  const subtotal = lines.reduce((s: number, l: any) => s + (l.total_price || 0), 0)
  const taxAmount = subtotal * ((tax_rate || 0) / 100)
  const total = subtotal + taxAmount

  // Generate invoice number
  const { count } = await supabase.from('invoices').select('*', { count:'exact', head:true }).eq('shop_id', user.shop_id)
  const year   = new Date().getFullYear()
  const invNum = `INV-${year}-${String((count || 0) + 1).padStart(4, '0')}`

  const { data: inv, error } = await supabase.from('invoices').insert({
    shop_id:     user.shop_id,
    so_id,
    customer_id: customer_id || (so as any).customer_id,
    invoice_number: invNum,
    status:      'draft',
    subtotal,
    tax_rate:    tax_rate || 0,
    tax_amount:  taxAmount,
    total,
    balance_due: total,
    amount_paid: 0,
    due_date:    due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    notes:       notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await log('invoice.created', user.shop_id, user.id, { table:'invoices', recordId: inv.id, newData:{ invoice_number: invNum, total } })
  return NextResponse.json(inv, { status: 201 })
}
