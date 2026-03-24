import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from    = searchParams.get('from') || new Date(Date.now() - 7*86400000).toISOString().split('T')[0]
  const to      = searchParams.get('to')   || new Date().toISOString().split('T')[0]
  const techId  = searchParams.get('tech_id')

  let q = supabase
    .from('so_time_entries')
    .select(`
      id, clocked_in_at, clocked_out_at, duration_minutes, notes,
      users(id, full_name, role, team),
      service_orders(so_number, status, assets(unit_number, make, model), customers(company_name))
    `)
    .eq('shop_id', user.shop_id)
    .is('deleted_at', null)
    .gte('clocked_in_at', from)
    .lte('clocked_in_at', to + 'T23:59:59')
    .not('clocked_out_at', 'is', null)
    .order('clocked_in_at', { ascending: false })

  if (techId) q = q.eq('user_id', techId)

  const { data: entries, error } = await q.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by technician
  const byTech: Record<string, any> = {}
  for (const e of entries || []) {
    const tech = (e.users as any)
    if (!tech) continue
    if (!byTech[tech.id]) {
      byTech[tech.id] = { id: tech.id, name: tech.full_name, team: tech.team, total_minutes: 0, entries: [] }
    }
    byTech[tech.id].total_minutes += e.duration_minutes || 0
    byTech[tech.id].entries.push({
      date:          e.clocked_in_at?.split('T')[0],
      in:            e.clocked_in_at?.split('T')[1]?.slice(0,5),
      out:           e.clocked_out_at?.split('T')[1]?.slice(0,5),
      minutes:       e.duration_minutes,
      so_number:     (e.service_orders as any)?.so_number,
      truck:         (e.service_orders as any)?.assets ? `#${(e.service_orders as any).assets.unit_number} ${(e.service_orders as any).assets.make}` : '—',
      customer:      (e.service_orders as any)?.customers?.company_name,
    })
  }

  const summary = Object.values(byTech).sort((a: any, b: any) => b.total_minutes - a.total_minutes)
  const total_minutes = summary.reduce((s: number, t: any) => s + t.total_minutes, 0)

  return NextResponse.json({ from, to, total_minutes, total_hours: (total_minutes / 60).toFixed(1), by_tech: summary })
}
