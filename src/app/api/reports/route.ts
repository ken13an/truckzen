import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const type   = searchParams.get('type') || 'overview'
  const from   = searchParams.get('from') || new Date(Date.now() - 30*86400000).toISOString().split('T')[0]
  const to     = searchParams.get('to')   || new Date().toISOString().split('T')[0]

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const supabase = db()

  switch (type) {

    case 'overview': {
      const [
        { data: invoices },
        { data: sos },
        { data: parts },
      ] = await Promise.all([
        supabase.from('invoices').select('status, total, balance_due, paid_at').eq('shop_id', shopId).gte('created_at', from).lte('created_at', to + 'T23:59:59'),
        supabase.from('service_orders').select('status, grand_total, created_at, completed_at').eq('shop_id', shopId).gte('created_at', from).lte('created_at', to + 'T23:59:59'),
        supabase.from('parts').select('on_hand, cost_price, sell_price').eq('shop_id', shopId),
      ])

      const paid    = invoices?.filter(i => i.status === 'paid') || []
      const revenue = paid.reduce((s, i) => s + (i.total || 0), 0)
      const outstanding = (invoices || []).filter(i => i.status === 'sent').reduce((s, i) => s + (i.balance_due || 0), 0)

      const completed = sos?.filter(s => ['done','good_to_go'].includes(s.status)) || []
      const avg_cycle = completed.reduce((s, so) => {
        if (!so.completed_at || !so.created_at) return s
        return s + (new Date(so.completed_at).getTime() - new Date(so.created_at).getTime()) / (1000 * 3600)
      }, 0) / (completed.length || 1)

      const inv_value = (parts || []).reduce((s, p) => s + (p.on_hand || 0) * (p.cost_price || 0), 0)

      return NextResponse.json({
        revenue,
        outstanding,
        so_count:    sos?.length || 0,
        so_completed:completed.length,
        avg_cycle_hours: Math.round(avg_cycle * 10) / 10,
        inventory_value: inv_value,
        period: { from, to },
      })
    }

    case 'revenue_by_day': {
      const { data: invs } = await supabase
        .from('invoices')
        .select('total, paid_at')
        .eq('shop_id', shopId)
        .eq('status', 'paid')
        .gte('paid_at', from)
        .lte('paid_at', to + 'T23:59:59')

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

    default:
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
  }
}
