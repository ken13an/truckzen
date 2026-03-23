import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const from = searchParams.get('from')
  const tab = searchParams.get('tab') || 'Overview'
  if (!shopId || !from) return NextResponse.json({ error: 'shop_id and from required' }, { status: 400 })

  if (tab === 'Overview') {
    const [repairs, fuel, expenses, pos, pmActive, pmOverdue] = await Promise.all([
      s.from('maint_road_repairs').select('total_cost').eq('shop_id', shopId).gte('reported_date', from),
      s.from('maint_fuel_entries').select('total_cost').eq('shop_id', shopId).gte('fuel_date', from),
      s.from('maint_expenses').select('amount').eq('shop_id', shopId).gte('expense_date', from),
      s.from('maint_purchase_orders').select('total').eq('shop_id', shopId).gte('ordered_date', from),
      s.from('maint_pm_schedules').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'active'),
      s.from('maint_pm_schedules').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'overdue'),
    ])
    const repairCost = (repairs.data || []).reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0)
    const fuelCost = (fuel.data || []).reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0)
    const expenseCost = (expenses.data || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0)
    const poCost = (pos.data || []).reduce((sum: number, r: any) => sum + (r.total || 0), 0)
    const total = (pmActive.count || 0) + (pmOverdue.count || 0)
    const pmCompliance = total > 0 ? Math.round(((pmActive.count || 0) / total) * 100) : 0
    return NextResponse.json({ repairCost, fuelCost, expenseCost, poCost, pmCompliance })
  }

  if (tab === 'Cost Per Truck') {
    const [{ data: repairs }, { data: fuel }, { data: expenses }] = await Promise.all([
      s.from('maint_road_repairs').select('asset_id, total_cost, assets(unit_number)').eq('shop_id', shopId).gte('reported_date', from),
      s.from('maint_fuel_entries').select('asset_id, total_cost, assets(unit_number)').eq('shop_id', shopId).gte('fuel_date', from),
      s.from('maint_expenses').select('asset_id, amount, assets(unit_number)').eq('shop_id', shopId).gte('expense_date', from),
    ])
    const byTruck: Record<string, any> = {}
    for (const r of (repairs || [])) {
      const un = (r.assets as any)?.unit_number || 'Unknown'
      if (!byTruck[un]) byTruck[un] = { unit_number: un, repairs: 0, fuel: 0, expenses: 0, total: 0 }
      byTruck[un].repairs += r.total_cost || 0
    }
    for (const r of (fuel || [])) {
      const un = (r.assets as any)?.unit_number || 'Unknown'
      if (!byTruck[un]) byTruck[un] = { unit_number: un, repairs: 0, fuel: 0, expenses: 0, total: 0 }
      byTruck[un].fuel += r.total_cost || 0
    }
    for (const r of (expenses || [])) {
      const un = (r.assets as any)?.unit_number || 'Unknown'
      if (!byTruck[un]) byTruck[un] = { unit_number: un, repairs: 0, fuel: 0, expenses: 0, total: 0 }
      byTruck[un].expenses += r.amount || 0
    }
    const trucks = Object.values(byTruck).map((t: any) => ({ ...t, total: t.repairs + t.fuel + t.expenses })).sort((a: any, b: any) => b.total - a.total)
    return NextResponse.json({ trucks })
  }

  if (tab === 'Fuel') {
    const { data } = await s.from('maint_fuel_entries').select('total_cost, gallons, cost_per_gallon').eq('shop_id', shopId).gte('fuel_date', from)
    const totalFuel = (data || []).reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0)
    const totalGallons = (data || []).reduce((sum: number, r: any) => sum + (r.gallons || 0), 0)
    const cpgs = (data || []).filter((r: any) => r.cost_per_gallon).map((r: any) => r.cost_per_gallon)
    const avgCpg = cpgs.length > 0 ? cpgs.reduce((a: number, b: number) => a + b, 0) / cpgs.length : 0
    return NextResponse.json({ totalFuel, totalGallons, avgCpg })
  }

  if (tab === 'PM Compliance') {
    const today = new Date().toISOString().split('T')[0]
    const [{ data: all }, { data: overdue }] = await Promise.all([
      s.from('maint_pm_schedules').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).in('status', ['active', 'overdue']),
      s.from('maint_pm_schedules').select('service_type, next_due_date, assets(unit_number)').eq('shop_id', shopId).eq('status', 'overdue').order('next_due_date').limit(20),
    ])
    const totalPm = all?.length ?? (all as any)?.count ?? 0
    const overdueList = (overdue || []).map((p: any) => ({
      unit_number: (p.assets as any)?.unit_number,
      service_type: p.service_type?.replace(/_/g, ' '),
      days_overdue: p.next_due_date ? Math.floor((Date.now() - new Date(p.next_due_date).getTime()) / 86400000) : 0,
    }))
    return NextResponse.json({ onTime: totalPm > 0 ? Math.round(((totalPm - overdueList.length) / totalPm) * 100) : 0, overdueCount: overdueList.length, overdueList })
  }

  if (tab === 'Driver') {
    const { data: drivers } = await s.from('maint_drivers').select('id, full_name').eq('shop_id', shopId).eq('active', true).order('full_name')
    const result = []
    for (const d of (drivers || [])) {
      const [insp, def, fuel, rep] = await Promise.all([
        s.from('maint_inspections').select('*', { count: 'exact', head: true }).eq('driver_id', d.id).gte('inspection_date', from),
        s.from('maint_inspection_defects').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).gte('created_at', from),
        s.from('maint_fuel_entries').select('*', { count: 'exact', head: true }).eq('driver_id', d.id).gte('fuel_date', from),
        s.from('maint_road_repairs').select('*', { count: 'exact', head: true }).eq('driver_id', d.id).gte('reported_date', from),
      ])
      result.push({ id: d.id, full_name: d.full_name, inspections: insp.count || 0, defects: def.count || 0, fuel_entries: fuel.count || 0, repairs: rep.count || 0 })
    }
    return NextResponse.json({ drivers: result })
  }

  if (tab === 'Vendor Spend') {
    const { data: vendors } = await s.from('maint_vendors').select('id, name').eq('shop_id', shopId).eq('active', true)
    const result = []
    for (const v of (vendors || [])) {
      const { data: repairs } = await s.from('maint_road_repairs').select('total_cost').eq('vendor_id', v.id).gte('reported_date', from)
      const total = (repairs || []).reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0)
      const count = (repairs || []).length
      result.push({ id: v.id, name: v.name, total, repair_count: count, avg_cost: count > 0 ? total / count : 0 })
    }
    result.sort((a: any, b: any) => b.total - a.total)
    return NextResponse.json({ vendors: result })
  }

  return NextResponse.json({})
}
