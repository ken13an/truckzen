import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const { searchParams } = new URL(req.url)
  const type   = searchParams.get('type') || 'overview'
  const from   = searchParams.get('from') || new Date(Date.now() - 30*86400000).toISOString().split('T')[0]
  const to     = searchParams.get('to')   || new Date().toISOString().split('T')[0]
  const sourceMode = searchParams.get('source_mode') || 'live' // 'live' | 'fullbay' | 'combined'

  const supabase = createAdminSupabaseClient()

  // Source mode filter helpers — applied to service_orders and invoices queries
  function applySOSourceFilter(q: any) {
    if (sourceMode === 'live') return q.or('is_historical.is.null,is_historical.eq.false').neq('source', 'fullbay')
    if (sourceMode === 'fullbay') return q.eq('is_historical', true).eq('source', 'fullbay')
    return q // combined — no filter
  }
  function applyInvoiceSourceFilter(q: any) {
    if (sourceMode === 'live') return q.neq('source', 'fullbay')
    if (sourceMode === 'fullbay') return q.eq('source', 'fullbay')
    return q // combined
  }
  function applyPartsSourceFilter(q: any) {
    if (sourceMode === 'live') return q.neq('source', 'fullbay')
    if (sourceMode === 'fullbay') return q.eq('source', 'fullbay')
    return q // combined
  }

  switch (type) {

    case 'overview': {
      const pgFrom = from + 'T00:00:00'
      const pgTo = to + 'T23:59:59'

      let soQ = supabase.from('service_orders').select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId).is('deleted_at', null).neq('status', 'void').not('so_number', 'like', 'DRAFT-%').gte('created_at', pgFrom).lte('created_at', pgTo)
      soQ = applySOSourceFilter(soQ)
      const { count: soCount } = await soQ

      let soCompQ = supabase.from('service_orders').select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId).is('deleted_at', null).neq('status', 'void').not('so_number', 'like', 'DRAFT-%').gte('created_at', pgFrom).lte('created_at', pgTo).in('status', ['done', 'good_to_go'])
      soCompQ = applySOSourceFilter(soCompQ)
      const { count: soCompleted } = await soCompQ

      let revenue = 0
      let page = 0
      while (true) {
        let revQ = supabase.from('service_orders').select('grand_total')
          .eq('shop_id', shopId).is('deleted_at', null).neq('status', 'void').not('so_number', 'like', 'DRAFT-%').gte('created_at', pgFrom).lte('created_at', pgTo)
          .range(page * 1000, (page + 1) * 1000 - 1)
        revQ = applySOSourceFilter(revQ)
        const { data: batch } = await revQ
        if (!batch || batch.length === 0) break
        revenue += batch.reduce((s: number, r: any) => s + (r.grand_total || 0), 0)
        if (batch.length < 1000) break
        page++
      }

      let paidQ = supabase.from('invoices').select('total')
        .eq('shop_id', shopId).is('deleted_at', null).eq('status', 'paid').gte('created_at', pgFrom).lte('created_at', pgTo)
      paidQ = applyInvoiceSourceFilter(paidQ)
      const { data: paidInvoices } = await paidQ
      const invoiceRevenue = (paidInvoices || []).reduce((s: number, i: any) => s + (i.total || 0), 0)

      let sentQ = supabase.from('invoices').select('balance_due')
        .eq('shop_id', shopId).is('deleted_at', null).eq('status', 'sent')
      sentQ = applyInvoiceSourceFilter(sentQ)
      const { data: sentInvoices } = await sentQ
      const outstanding = (sentInvoices || []).reduce((s: number, i: any) => s + (i.balance_due || 0), 0)

      let partsQ = supabase.from('parts').select('on_hand, cost_price').eq('shop_id', shopId).is('deleted_at', null)
      partsQ = applyPartsSourceFilter(partsQ)
      const { data: parts } = await partsQ
      const inv_value = (parts || []).reduce((s: number, p: any) => s + (p.on_hand || 0) * (p.cost_price || 0), 0)

      return NextResponse.json({
        revenue: revenue || invoiceRevenue,
        outstanding,
        so_count: soCount || 0,
        so_completed: soCompleted || 0,
        avg_cycle_hours: 0,
        inventory_value: inv_value,
        period: { from, to },
      })
    }

    case 'revenue_by_day': {
      let revDayQ = supabase
        .from('invoices')
        .select('total, paid_at')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .eq('status', 'paid')
        .gte('paid_at', from)
        .lte('paid_at', to + 'T23:59:59')
      revDayQ = applyInvoiceSourceFilter(revDayQ)
      const { data: invs } = await revDayQ

      const byDay: Record<string, number> = {}
      for (const inv of invs || []) {
        const day = inv.paid_at?.split('T')[0]
        if (day) byDay[day] = (byDay[day] || 0) + (inv.total || 0)
      }
      return NextResponse.json(Object.entries(byDay).map(([date, revenue]) => ({ date, revenue })).sort((a,b) => a.date.localeCompare(b.date)))
    }

    case 'labor_by_tech': {
      const { data: lines } = await supabase
        .from('so_lines')
        .select('total_price, service_orders!inner(assigned_tech, users!assigned_tech(full_name), shop_id, created_at)')
        .eq('service_orders.shop_id', shopId)
        .eq('line_type', 'labor')
        .gte('service_orders.created_at', from)
        .lte('service_orders.created_at', to + 'T23:59:59')

      const byTech: Record<string, { name: string; revenue: number; jobs: number }> = {}
      for (const line of lines || []) {
        const so   = line.service_orders as any
        const tech = so?.users?.full_name || 'Unassigned'
        const id   = so?.assigned_tech || 'none'
        if (!byTech[id]) byTech[id] = { name: tech, revenue: 0, jobs: 0 }
        byTech[id].revenue += line.total_price || 0
        byTech[id].jobs    += 1
      }
      return NextResponse.json(Object.values(byTech).sort((a,b) => b.revenue - a.revenue))
    }

    case 'parts_profitability': {
      const { data: partLines } = await supabase
        .from('so_lines')
        .select('description, total_price, quantity, unit_price, service_orders!inner(shop_id, created_at)')
        .eq('service_orders.shop_id', shopId)
        .eq('line_type', 'part')
        .gte('service_orders.created_at', from)
        .lte('service_orders.created_at', to + 'T23:59:59')

      const byPart: Record<string, { description: string; revenue: number; qty: number }> = {}
      for (const line of partLines || []) {
        const key = line.description
        if (!byPart[key]) byPart[key] = { description: key, revenue: 0, qty: 0 }
        byPart[key].revenue += line.total_price || 0
        byPart[key].qty     += line.quantity    || 0
      }
      return NextResponse.json(Object.values(byPart).sort((a,b) => b.revenue - a.revenue).slice(0, 20))
    }

    case 'top_customers': {
      let custQ = supabase
        .from('service_orders')
        .select('grand_total, customers!inner(id, company_name)')
        .eq('shop_id', shopId).is('deleted_at', null).neq('status', 'void')
        .gte('created_at', from)
        .lte('created_at', to + 'T23:59:59')
      custQ = applySOSourceFilter(custQ)
      const { data: sos } = await custQ

      const byCust: Record<string, { name: string; revenue: number; wos: number }> = {}
      for (const so of sos || []) {
        const c = so.customers as any
        const key = c?.id || 'unknown'
        if (!byCust[key]) byCust[key] = { name: c?.company_name || 'Unknown', revenue: 0, wos: 0 }
        byCust[key].revenue += so.grand_total || 0
        byCust[key].wos += 1
      }
      return NextResponse.json(Object.values(byCust).sort((a, b) => b.revenue - a.revenue).slice(0, 10))
    }

    case 'labor': {
      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('user_id, duration_minutes, users!inner(full_name)')
        .eq('shop_id', shopId)
        .gte('clock_in', from)
        .lte('clock_in', to + 'T23:59:59')

      let laborSOQ = supabase
        .from('service_orders')
        .select('assigned_tech, status')
        .eq('shop_id', shopId).is('deleted_at', null).neq('status', 'void')
        .gte('created_at', from)
        .lte('created_at', to + 'T23:59:59')
        .not('assigned_tech', 'is', null)
      laborSOQ = applySOSourceFilter(laborSOQ)
      const { data: sosByTech } = await laborSOQ

      const byMech: Record<string, { name: string; hours: number; wos_completed: number; wos_total: number }> = {}
      for (const te of timeEntries || []) {
        const u = te.users as any
        const key = te.user_id
        if (!byMech[key]) byMech[key] = { name: u?.full_name || 'Unknown', hours: 0, wos_completed: 0, wos_total: 0 }
        byMech[key].hours += (te.duration_minutes || 0) / 60
      }
      for (const so of sosByTech || []) {
        const key = so.assigned_tech
        if (!byMech[key]) byMech[key] = { name: key, hours: 0, wos_completed: 0, wos_total: 0 }
        byMech[key].wos_total += 1
        if (['done', 'good_to_go'].includes(so.status)) byMech[key].wos_completed += 1
      }
      return NextResponse.json(Object.values(byMech).sort((a, b) => b.hours - a.hours))
    }

    case 'trucks': {
      let truckQ = supabase
        .from('service_orders')
        .select('grand_total, created_at, assets!inner(id, unit_number, customers(company_name))')
        .eq('shop_id', shopId).is('deleted_at', null).neq('status', 'void')
        .gte('created_at', from)
        .lte('created_at', to + 'T23:59:59')
      truckQ = applySOSourceFilter(truckQ)
      const { data: sos } = await truckQ

      const byUnit: Record<string, { unit_number: string; company: string; visits: number; spend: number; last_service: string }> = {}
      for (const so of sos || []) {
        const a = so.assets as any
        const key = a?.id || 'unknown'
        if (!byUnit[key]) byUnit[key] = { unit_number: a?.unit_number || '—', company: a?.customers?.company_name || '—', visits: 0, spend: 0, last_service: '' }
        byUnit[key].visits += 1
        byUnit[key].spend += so.grand_total || 0
        if (!byUnit[key].last_service || so.created_at > byUnit[key].last_service) byUnit[key].last_service = so.created_at
      }
      return NextResponse.json(Object.values(byUnit).sort((a, b) => b.visits - a.visits))
    }

    case 'low_stock': {
      let lsQ = supabase
        .from('parts')
        .select('part_number, description, on_hand, reorder_point, cost_price')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .order('on_hand', { ascending: true })
        .limit(20)
      lsQ = applyPartsSourceFilter(lsQ)
      const { data: parts } = await lsQ

      return NextResponse.json((parts || []).filter((p: any) => p.on_hand <= (p.reorder_point || 2)))
    }

    default:
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
  }
}
