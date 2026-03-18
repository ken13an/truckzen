import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get part info
  const { data: part } = await supabase.from('parts').select('description, part_number').eq('id', id).eq('shop_id', user.shop_id).single()
  if (!part) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Find all SO lines where this part was used (by part number or description match)
  const { data: usages } = await supabase
    .from('so_lines')
    .select(`
      id, quantity, unit_price, total_price, created_at,
      service_orders!inner(
        so_number, completed_at,
        assets(unit_number, make, model),
        customers(company_name)
      )
    `)
    .eq('shop_id', user.shop_id)
    .eq('line_type', 'part')
    .or(`part_number.eq.${part.part_number},description.ilike.%${part.description.slice(0,30)}%`)
    .order('created_at', { ascending: false })
    .limit(50)

  const totalUsed     = (usages || []).reduce((s, u) => s + (u.quantity || 0), 0)
  const totalRevenue  = (usages || []).reduce((s, u) => s + (u.total_price || 0), 0)

  return NextResponse.json({
    part_id:      id,
    description:  part.description,
    part_number:  part.part_number,
    total_used:   totalUsed,
    total_revenue:totalRevenue,
    usages: (usages || []).map(u => ({
      so_number:    (u.service_orders as any)?.so_number,
      truck:        (u.service_orders as any)?.assets ? `#${(u.service_orders as any).assets.unit_number} ${(u.service_orders as any).assets.make}` : '—',
      customer:     (u.service_orders as any)?.customers?.company_name,
      quantity:     u.quantity,
      unit_price:   u.unit_price,
      total_price:  u.total_price,
      date:         u.created_at?.split('T')[0],
    })),
  })
}
