import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, vendors(name), so_lines:po_lines(id, description, quantity, quantity_received, unit_cost, total_cost)')
    .eq('shop_id', user.shop_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','parts_manager','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const { vendor_id, vendor_name, lines, notes, so_id } = body

  if (!lines?.length) return NextResponse.json({ error: 'At least one line item required' }, { status: 400 })

  // Generate PO number
  const { count } = await supabase.from('purchase_orders').select('*', { count:'exact', head:true }).eq('shop_id', user.shop_id).is('deleted_at', null)
  const poNum  = `PO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4,'0')}`
  const total  = lines.reduce((s: number, l: any) => s + ((l.quantity || 1) * (l.unit_cost || 0)), 0)

  const { data: po, error } = await supabase.from('purchase_orders').insert({
    shop_id:     user.shop_id,
    po_number:   poNum,
    vendor_id:   vendor_id || null,
    vendor_name: vendor_name || null,
    so_id:       so_id || null,
    status:      'draft',
    total,
    notes:       notes || null,
    created_by:  user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert PO lines
  const poLines = lines.map((l: any) => ({
    po_id:       po.id,
    part_id:     l.part_id || null,
    part_number: l.part_number || null,
    description: l.description,
    quantity:    l.quantity || 1,
    quantity_received: 0,
    unit_cost:   l.unit_cost || 0,
    total_cost:  (l.quantity || 1) * (l.unit_cost || 0),
  }))

  await supabase.from('po_lines').insert(poLines)

  return NextResponse.json({ ...po, lines: poLines }, { status: 201 })
}
