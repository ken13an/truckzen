import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

  const [repairs, overdue, cdls, fuel, defects, drivers] = await Promise.all([
    s.from('maint_road_repairs').select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId).not('status', 'in', '("completed","invoiced")'),
    s.from('maint_pm_schedules').select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId).eq('status', 'overdue'),
    s.from('maint_drivers').select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId).eq('active', true)
      .gte('cdl_expiry', today).lte('cdl_expiry', in30),
    s.from('maint_fuel_entries').select('total_cost')
      .eq('shop_id', shopId).gte('fuel_date', monthStart),
    s.from('maint_inspection_defects').select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId).eq('resolved', false),
    s.from('maint_drivers').select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId).eq('active', true),
  ])

  const fuelSpend = (fuel.data || []).reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0)

  return NextResponse.json({
    activeRepairs: repairs.count || 0,
    overduePMs: overdue.count || 0,
    expiringCDLs: cdls.count || 0,
    fuelSpendMonth: fuelSpend,
    openDefects: defects.count || 0,
    totalDrivers: drivers.count || 0,
  })
}
