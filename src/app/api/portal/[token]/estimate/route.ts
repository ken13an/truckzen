import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = db()

  // Find estimate by approval_token
  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('approval_token', token)
    .single()

  if (error || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  // Mark as viewed
  if (!estimate.viewed_at) {
    await supabase.from('estimates').update({ viewed_at: new Date().toISOString() }).eq('id', estimate.id)
  }

  // Get lines
  const { data: lines } = await supabase
    .from('estimate_lines')
    .select('*')
    .eq('estimate_id', estimate.id)
    .order('line_number')

  // Get service order + asset
  let serviceOrder = null
  if (estimate.repair_order_id) {
    const { data: so } = await supabase
      .from('service_orders')
      .select('id, so_number, status, complaint, assets(unit_number, year, make, model, vin)')
      .eq('id', estimate.repair_order_id)
      .single()
    serviceOrder = so
  }

  // Get shop info
  const { data: shop } = await supabase
    .from('shops')
    .select('name, dba, phone, email, tax_rate')
    .eq('id', estimate.shop_id)
    .single()

  return NextResponse.json({
    ...estimate,
    lines: lines || [],
    service_order: serviceOrder,
    shop,
  })
}
