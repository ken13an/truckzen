import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/tires?shop_id=...&asset_id=...&status=...
export async function GET(req: Request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const assetId = searchParams.get('asset_id')
  const status = searchParams.get('status') || 'active'
  const view = searchParams.get('view') // 'fleet' = grouped by asset

  if (view === 'fleet') {
    // Fleet dashboard: all assets with tire summaries
    const { data: assets } = await supabase
      .from('assets')
      .select('id, unit_number, year, make, model, odometer, status, customers(company_name)')
      .eq('shop_id', shopId)
      .not('status', 'eq', 'retired')
      .order('unit_number')

    const { data: tires } = await supabase
      .from('tires')
      .select('id, asset_id, position, brand, size, install_mileage, expected_life, current_tread, legal_min_tread, status, cost, is_recap')
      .eq('shop_id', shopId)
      .eq('status', 'active')

    // Group tires by asset
    const tireMap: Record<string, any[]> = {}
    for (const t of tires || []) {
      if (!tireMap[t.asset_id]) tireMap[t.asset_id] = []
      tireMap[t.asset_id].push(t)
    }

    const fleet = (assets || []).map(a => {
      const at = tireMap[a.id] || []
      const worstLife = at.length > 0
        ? Math.min(...at.map(t => {
            const used = (a.odometer || 0) - (t.install_mileage || 0)
            return Math.max(0, 1 - used / (t.expected_life || 100000))
          }))
        : 1
      const totalCost = at.reduce((s: number, t: any) => s + (t.cost || 0), 0)
      return { ...a, tires: at, tire_count: at.length, worst_life_pct: Math.round(worstLife * 100), total_tire_cost: totalCost }
    })

    return NextResponse.json(fleet)
  }

  // Single asset or all tires
  let q = supabase.from('tires')
    .select('*, assets(unit_number, odometer, year, make, model)')
    .eq('shop_id', shopId)

  if (assetId) q = q.eq('asset_id', assetId)
  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q.order('position')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/tires — create/update tire, log tread, log pressure, rotate, record failure
export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const { action, shop_id } = body

  if (!shop_id || !action) return NextResponse.json({ error: 'shop_id and action required' }, { status: 400 })

  switch (action) {
    case 'install': {
      const { asset_id, position, brand, model, size, dot_code, is_recap, recap_vendor, install_mileage, expected_life, cost, vendor, current_tread, notes } = body
      const qr = `TZ-TIRE-${Date.now().toString(36).toUpperCase()}`
      const legalMin = position?.startsWith('steer') ? 4.0 : 2.0
      const { data, error } = await supabase.from('tires').insert({
        shop_id, asset_id, position, brand, model, size, dot_code, is_recap: is_recap || false, recap_vendor,
        install_date: new Date().toISOString().split('T')[0],
        install_mileage: install_mileage || 0, expected_life: expected_life || 100000,
        cost: cost || 0, vendor, current_tread: current_tread || 12,
        legal_min_tread: legalMin, qr_token: qr, notes, status: 'active',
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data, { status: 201 })
    }

    case 'log_tread': {
      const { tire_id, tread_depth, mileage, measured_by } = body
      await supabase.from('tire_tread_logs').insert({ tire_id, shop_id, tread_depth, mileage, measured_by })
      await supabase.from('tires').update({ current_tread: tread_depth, updated_at: new Date().toISOString() }).eq('id', tire_id)
      return NextResponse.json({ ok: true })
    }

    case 'log_pressure': {
      const { tire_id, asset_id, psi, target_psi, logged_by, dvir_id } = body
      await supabase.from('tire_pressure_logs').insert({ tire_id, shop_id, asset_id, psi, target_psi: target_psi || 100, logged_by, dvir_id })
      return NextResponse.json({ ok: true })
    }

    case 'rotate': {
      const { asset_id, mileage, rotated_by, moves, notes } = body
      // moves: [{ tire_id, from_position, to_position }]
      for (const m of moves || []) {
        await supabase.from('tires').update({ position: m.to_position }).eq('id', m.tire_id)
      }
      await supabase.from('tire_rotations').insert({ shop_id, asset_id, mileage, rotated_by, moves, notes })
      return NextResponse.json({ ok: true })
    }

    case 'remove': {
      const { tire_id, removed_mileage, removal_reason, failure_notes, failure_photos } = body
      const status = removal_reason === 'failure' ? 'failed' : removal_reason === 'retread' ? 'retreaded' : 'removed'
      await supabase.from('tires').update({
        status, removed_date: new Date().toISOString().split('T')[0],
        removed_mileage, removal_reason, failure_notes, failure_photos: failure_photos || [],
      }).eq('id', tire_id)
      return NextResponse.json({ ok: true })
    }

    case 'add_price': {
      const { vendor, brand: b, model: m, size: sz, is_recap: recap, price, notes } = body
      await supabase.from('tire_vendor_prices').insert({ shop_id, vendor, brand: b, model: m, size: sz, is_recap: recap || false, price, notes })
      return NextResponse.json({ ok: true })
    }

    case 'qr_lookup': {
      const { qr_token } = body
      const { data } = await supabase.from('tires')
        .select('*, assets(unit_number, year, make, model, odometer), tire_tread_logs(tread_depth, mileage, measured_at), tire_pressure_logs(psi, logged_at)')
        .eq('qr_token', qr_token)
        .single()
      if (!data) return NextResponse.json({ error: 'Tire not found' }, { status: 404 })
      return NextResponse.json(data)
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
