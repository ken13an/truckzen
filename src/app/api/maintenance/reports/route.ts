import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { WO_FULL_ACCESS_ROLES } from '@/lib/roles'

// Maintenance reports. Shop-scoped: actor must hold a WO_FULL_ACCESS_ROLES
// role and shop scope comes from the server session. Query shop_id is no
// longer trusted.
export async function GET(req: Request) {
  const ctx = await requireRouteContext([...WO_FULL_ACCESS_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const tab = searchParams.get('tab') || 'Overview'
  if (!from) return NextResponse.json({ error: 'from required' }, { status: 400 })

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

  if (tab === 'Issues & Faults') {
    const [issues, faults, topFaults] = await Promise.all([
      s.from('maint_issues').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'open'),
      s.from('maint_faults').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('resolved', false),
      s.from('maint_faults').select('fault_code, severity').eq('shop_id', shopId).gte('created_at', from),
    ])
    const faultMap: Record<string, { count: number; severity: string }> = {}
    for (const f of (topFaults.data || [])) {
      if (!faultMap[f.fault_code]) faultMap[f.fault_code] = { count: 0, severity: f.severity }
      faultMap[f.fault_code].count++
    }
    const topList = Object.entries(faultMap).map(([code, v]) => ({ fault_code: code, ...v })).sort((a, b) => b.count - a.count).slice(0, 10)
    return NextResponse.json({ openIssues: issues.count || 0, openFaults: faults.count || 0, avgResolution: 0, topFaults: topList })
  }

  if (tab === 'Compliance') {
    const today = new Date().toISOString().split('T')[0]
    const [srOv, srOk, vrOv, vrOk, crOv, crOk] = await Promise.all([
      s.from('maint_service_reminders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('overdue', true),
      s.from('maint_service_reminders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'active').eq('overdue', false),
      s.from('maint_vehicle_renewals').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'active').lt('expiry_date', today),
      s.from('maint_vehicle_renewals').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'active').gte('expiry_date', today),
      s.from('maint_contact_renewals').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'active').lt('expiry_date', today),
      s.from('maint_contact_renewals').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'active').gte('expiry_date', today),
    ])
    return NextResponse.json({ srOverdue: srOv.count || 0, srOk: srOk.count || 0, vrOverdue: vrOv.count || 0, vrOk: vrOk.count || 0, crOverdue: crOv.count || 0, crOk: crOk.count || 0 })
  }

  if (tab === 'Warranties') {
    const [active, claims, totalClaimed] = await Promise.all([
      s.from('maint_warranties').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('current_status', 'active'),
      s.from('maint_warranty_claims').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).gte('claim_date', from),
      s.from('maint_warranty_claims').select('amount_approved').eq('shop_id', shopId).gte('claim_date', from),
    ])
    const total = (totalClaimed.data || []).reduce((sum: number, c: any) => sum + (c.amount_approved || 0), 0)
    return NextResponse.json({ activeWarranties: active.count || 0, claimsCount: claims.count || 0, totalClaimed: total })
  }

  return NextResponse.json({})
}
