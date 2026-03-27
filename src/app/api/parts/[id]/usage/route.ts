import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params;
  const user = await getAuthenticatedUserProfile()
  if (!user) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(user)
  if (!shopId) return jsonError('No shop context', 400)

  const s = db()

  // Get part info
  const { data: part } = await s.from('parts').select('description, part_number').eq('id', id).eq('shop_id', shopId).single()
  if (!part) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Find all SO lines where this part was used (by part number or description match)
  const { data: usages } = await s
    .from('so_lines')
    .select(`
      id, quantity, unit_price, total_price, created_at,
      service_orders!inner(
        so_number, completed_at,
        assets(unit_number, make, model),
        customers(company_name)
      )
    `)
    .eq('shop_id', shopId)
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
