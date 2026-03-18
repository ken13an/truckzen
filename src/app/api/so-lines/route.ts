import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { log } from '@/lib/security'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const soId = searchParams.get('so_id')
  if (!soId) return NextResponse.json({ error: 'so_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('so_lines')
    .select('*')
    .eq('so_id', soId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','service_advisor','service_writer','technician','maintenance_technician','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const { so_id, line_type, description, part_number, quantity, unit_price } = body

  if (!so_id || !line_type || !description)
    return NextResponse.json({ error: 'so_id, line_type, description required' }, { status: 400 })

  // Verify SO belongs to this shop
  const { data: so } = await supabase.from('service_orders').select('id, shop_id, grand_total').eq('id', so_id).eq('shop_id', user.shop_id).single()
  if (!so) return NextResponse.json({ error: 'Service order not found' }, { status: 404 })

  const qty        = parseFloat(quantity) || 1
  const unitPrice  = parseFloat(unit_price) || 0
  const totalPrice = qty * unitPrice

  const { data, error } = await supabase.from('so_lines').insert({
    so_id,
    shop_id:     user.shop_id,
    line_type:   line_type,   // labor | part | sublet | fee
    description: description.trim(),
    part_number: part_number?.trim() || null,
    quantity:    qty,
    unit_price:  unitPrice,
    total_price: totalPrice,
    added_by:    user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalculate SO grand total
  const { data: allLines } = await supabase.from('so_lines').select('total_price').eq('so_id', so_id)
  const grandTotal = (allLines || []).reduce((s, l) => s + (l.total_price || 0), 0)
  await supabase.from('service_orders').update({ grand_total: grandTotal }).eq('id', so_id)

  await log('parts.added' as any, user.shop_id, user.id, {
    table: 'so_lines', recordId: data.id,
    newData: { so_id, line_type, description, total_price: totalPrice },
  })

  return NextResponse.json({ ...data, updated_grand_total: grandTotal }, { status: 201 })
}
