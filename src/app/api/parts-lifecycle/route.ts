import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { SERVICE_PARTS_ROLES } from '@/lib/roles'

// Parts-lifecycle routes are shop-scoped operational tools. Body/query
// shop_id is no longer trusted — shop scope comes from the server session.
// Every write to part_installs / part_type_configs / part_vendor_prices is
// constrained by `.eq('shop_id', shopId)` to prevent cross-shop mutation
// through a stolen install_id / asset_id.

export async function GET(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_PARTS_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { searchParams: p } = new URL(req.url)
  const view = p.get('view')
  const assetId = p.get('asset_id')
  const partType = p.get('part_type')

  // Part type configs
  if (view === 'configs') {
    const { data } = await s.from('part_type_configs').select('*').eq('shop_id', shopId).eq('active', true).order('display_name').limit(200)
    return NextResponse.json(data || [])
  }

  // Fleet dashboard
  if (view === 'fleet') {
    const { data: assets } = await s.from('assets').select('id, unit_number, year, make, model, odometer, status, customers(company_name)')
      .eq('shop_id', shopId).is('deleted_at', null).not('status', 'eq', 'retired').order('unit_number').limit(500)
    const { data: installs } = await s.from('part_installs').select('id, asset_id, part_type, install_mileage, install_date, expected_life_mi, expected_life_days, cost, brand, status')
      .eq('shop_id', shopId).eq('status', 'active').limit(5000)
    const { data: configs } = await s.from('part_type_configs').select('part_type, display_name, icon, default_life_mi, default_life_days')
      .eq('shop_id', shopId).eq('active', true).limit(200)

    const configMap = new Map((configs || []).map((c: any) => [c.part_type, c]))
    const installMap: Record<string, any[]> = {}
    for (const i of installs || []) {
      if (!installMap[i.asset_id]) installMap[i.asset_id] = []
      installMap[i.asset_id].push(i)
    }

    const fleet = (assets || []).map((a: any) => {
      const parts = installMap[a.id] || []
      let worstPct = 100
      let totalCost = 0
      const partSummary: any[] = []

      for (const pi of parts) {
        const cfg = configMap.get(pi.part_type)
        const lifeMi = pi.expected_life_mi || cfg?.default_life_mi
        const lifeDays = pi.expected_life_days || cfg?.default_life_days
        let pctMi = 100, pctDays = 100
        if (lifeMi) { const used = (a.odometer || 0) - (pi.install_mileage || 0); pctMi = Math.max(0, Math.round((1 - used / lifeMi) * 100)) }
        if (lifeDays) { const daysSince = Math.floor((Date.now() - new Date(pi.install_date).getTime()) / 86400000); pctDays = Math.max(0, Math.round((1 - daysSince / lifeDays) * 100)) }
        const pct = Math.min(pctMi, pctDays)
        if (pct < worstPct) worstPct = pct
        totalCost += pi.cost || 0
        partSummary.push({ ...pi, life_pct: pct, config: cfg })
      }

      return { ...a, parts: partSummary, part_count: parts.length, worst_life_pct: worstPct, total_parts_cost: totalCost }
    })
    return NextResponse.json(fleet)
  }

  // Forecast: upcoming replacements
  if (view === 'forecast') {
    const days = parseInt(p.get('days') || '90')
    const { data: installs } = await s.from('part_installs')
      .select('*, assets(unit_number, odometer, year, make, model), part_type_configs!inner(display_name, icon)')
      .eq('shop_id', shopId).eq('status', 'active')

    // This join won't work since part_type_configs isn't FK'd. Do it manually.
    const { data: allInstalls } = await s.from('part_installs').select('*, assets(unit_number, odometer, year, make, model)')
      .eq('shop_id', shopId).eq('status', 'active').limit(5000)
    const { data: configs } = await s.from('part_type_configs').select('*').eq('shop_id', shopId).limit(200)
    const cfgMap = new Map((configs || []).map((c: any) => [c.part_type, c]))

    const upcoming: any[] = []
    for (const pi of allInstalls || []) {
      const cfg = cfgMap.get(pi.part_type)
      const lifeMi = pi.expected_life_mi || cfg?.default_life_mi
      const lifeDays = pi.expected_life_days || cfg?.default_life_days
      const odo = (pi.assets as any)?.odometer || 0

      let dueMi = Infinity, dueDays = Infinity
      if (lifeMi) dueMi = (pi.install_mileage || 0) + lifeMi - odo
      if (lifeDays) {
        const installDate = new Date(pi.install_date)
        const dueDate = new Date(installDate.getTime() + lifeDays * 86400000)
        dueDays = Math.floor((dueDate.getTime() - Date.now()) / 86400000)
      }

      const daysUntil = Math.min(dueMi === Infinity ? Infinity : Math.round(dueMi / 150), dueDays) // rough: 150mi/day avg
      if (daysUntil <= days) {
        upcoming.push({ ...pi, config: cfg, days_until: Math.max(0, Math.round(daysUntil)), miles_remaining: dueMi === Infinity ? null : Math.max(0, dueMi) })
      }
    }

    upcoming.sort((a, b) => a.days_until - b.days_until)
    return NextResponse.json(upcoming)
  }

  // Asset detail
  if (assetId) {
    let q = s.from('part_installs').select('*').eq('shop_id', shopId).eq('asset_id', assetId)
    if (partType) q = q.eq('part_type', partType)
    const { data } = await q.order('install_date', { ascending: false })
    return NextResponse.json(data || [])
  }

  // Vendor prices
  if (view === 'prices') {
    const { data } = await s.from('part_vendor_prices').select('*').eq('shop_id', shopId).order('quoted_at', { ascending: false }).limit(200)
    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: 'Specify view, asset_id, or part_type' }, { status: 400 })
}

export async function POST(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_PARTS_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const body = await req.json()
  const { action } = body
  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  switch (action) {
    case 'install': {
      const { asset_id, part_type, part_number, brand, description, position, install_date, install_mileage, install_hours, expected_life_mi, expected_life_days, cost, vendor, so_id, invoice_id, part_id, pm_schedule_id, notes } = body
      // Mark previous active install of same type as replaced
      await s.from('part_installs')
        .update({ status: 'replaced', replaced_date: install_date || new Date().toISOString().split('T')[0], replaced_mileage: install_mileage, replaced_reason: 'scheduled_replacement' })
        .eq('shop_id', shopId).eq('asset_id', asset_id).eq('part_type', part_type).eq('status', 'active')
      // If position specified, only replace that position
      if (position) {
        await s.from('part_installs')
          .update({ status: 'replaced', replaced_date: install_date || new Date().toISOString().split('T')[0], replaced_mileage: install_mileage })
          .eq('shop_id', shopId).eq('asset_id', asset_id).eq('part_type', part_type).eq('position', position).eq('status', 'active')
      }
      const { data, error } = await s.from('part_installs').insert({
        shop_id: shopId, asset_id, part_type, part_number, brand, description, position,
        install_date: install_date || new Date().toISOString().split('T')[0],
        install_mileage: install_mileage || 0, install_hours: install_hours || 0,
        expected_life_mi, expected_life_days, cost: cost || 0, vendor,
        so_id, invoice_id, part_id, pm_schedule_id, notes, status: 'active',
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      // Deduct from inventory if part_id provided
      if (part_id) {
        const { data: pt } = await s.from('parts').select('on_hand, shop_id').eq('id', part_id).single()
        if (pt && pt.shop_id === shopId) await s.from('parts').update({ on_hand: Math.max(0, (pt.on_hand || 0) - 1) }).eq('id', part_id).eq('shop_id', shopId)
      }
      return NextResponse.json(data, { status: 201 })
    }

    case 'replace': {
      const { install_id, reason, mileage } = body
      await s.from('part_installs').update({
        status: 'replaced', replaced_date: new Date().toISOString().split('T')[0],
        replaced_mileage: mileage, replaced_reason: reason || 'replaced',
      }).eq('id', install_id).eq('shop_id', shopId)
      return NextResponse.json({ ok: true })
    }

    case 'fail': {
      const { install_id, reason, mileage, notes } = body
      await s.from('part_installs').update({
        status: 'failed', replaced_date: new Date().toISOString().split('T')[0],
        replaced_mileage: mileage, replaced_reason: reason || 'failure', notes,
      }).eq('id', install_id).eq('shop_id', shopId)
      return NextResponse.json({ ok: true })
    }

    case 'save_config': {
      const { part_type, display_name, category, default_life_mi, default_life_days, preferred_vendor, preferred_brand, preferred_pn, icon } = body
      const { error } = await s.from('part_type_configs').upsert({
        shop_id: shopId, part_type, display_name, category, default_life_mi, default_life_days,
        preferred_vendor, preferred_brand, preferred_pn, icon: icon || '', active: true,
      }, { onConflict: 'shop_id,part_type' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    case 'add_price': {
      const { part_type, part_number, brand, vendor, price, notes } = body
      await s.from('part_vendor_prices').insert({ shop_id: shopId, part_type, part_number, brand, vendor, price, notes })
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
