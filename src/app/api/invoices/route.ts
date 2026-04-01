import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { log } from '@/lib/security'
import { logAction } from '@/lib/services/auditLog'

// ── GET list + POST create ────────────────────────────────────
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','accountant','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('q')
  const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50'), 50)
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const historical = searchParams.get('historical')

  // Shared filter builder
  function applyFilters(q: any) {
    if (status && status !== 'all') q = q.eq('status', status)
    if (search) q = q.or(`invoice_number.ilike.%${search}%`)
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59')
    if (historical === 'false') q = q.or('is_historical.is.null,is_historical.eq.false')
    if (historical === 'true') q = q.eq('is_historical', true)
    return q
  }

  // Separate HEAD count query
  let countQ = supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', user.shop_id)
    .is('deleted_at', null)
  countQ = applyFilters(countQ)

  // Summary counts (unfiltered by status for pills)
  const summaryQ = Promise.all([
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', user.shop_id).is('deleted_at', null),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', user.shop_id).is('deleted_at', null).eq('status', 'sent'),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', user.shop_id).is('deleted_at', null).eq('status', 'paid'),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', user.shop_id).is('deleted_at', null).eq('status', 'overdue'),
  ])

  // Page data query
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  let q = supabase
    .from('invoices')
    .select('id, invoice_number, status, subtotal, tax_amount, total, balance_due, amount_paid, due_date, paid_at, created_at, is_historical, source, customers(company_name), service_orders(so_number, is_historical, assets(unit_number))')
    .eq('shop_id', user.shop_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)
  q = applyFilters(q)

  const [{ count: total }, { data, error }, [allCount, sentCount, paidCount, overdueCount]] = await Promise.all([countQ, q, summaryQ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data || [],
    total: total || 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((total || 0) / perPage),
    summary: {
      all: allCount.count || 0,
      sent: sentCount.count || 0,
      paid: paidCount.count || 0,
      overdue: overdueCount.count || 0,
    },
  })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','accountant','office_admin']
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
  const { count } = await supabase.from('invoices').select('*', { count:'exact', head:true }).eq('shop_id', user.shop_id).is('deleted_at', null)
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

  // Fire and forget
  logAction({ shop_id: user.shop_id, user_id: user.id, action: 'invoice.created', entity_type: 'invoice', entity_id: inv.id, details: { invoice_number: invNum } }).catch(() => {})

  // Notify accounting team
  try {
    const { createNotification, getUserIdsByRole } = await import('@/lib/createNotification')
    const acctUsers = await getUserIdsByRole(user.shop_id, ['owner', 'gm', 'accountant', 'accounting_manager', 'office_admin'])
    const others = acctUsers.filter(uid => uid !== user.id)
    if (others.length > 0) await createNotification({ shopId: user.shop_id, recipientId: others, type: 'invoice_created', title: `Invoice #${invNum} created`, body: `Total: $${total.toFixed(2)}`, link: `/invoices/${inv.id}` })
  } catch (err) { console.error('Notification failed:', err) }

  return NextResponse.json(inv, { status: 201 })
}
