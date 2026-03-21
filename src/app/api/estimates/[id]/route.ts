import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = db()

  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  const { data: lines } = await supabase
    .from('estimate_lines')
    .select('*')
    .eq('estimate_id', id)
    .order('line_number')

  // Get service order info if linked
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

  return NextResponse.json({ ...estimate, lines: lines || [], service_order: serviceOrder, shop })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const supabase = db()

  // Build update object
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }

  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'sent') {
      updates.sent_at = new Date().toISOString()
      updates.valid_until = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    }
  }
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.customer_name !== undefined) updates.customer_name = body.customer_name
  if (body.customer_email !== undefined) updates.customer_email = body.customer_email
  if (body.customer_phone !== undefined) updates.customer_phone = body.customer_phone

  const { data: estimate, error } = await supabase
    .from('estimates')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update lines if provided
  if (body.lines && Array.isArray(body.lines)) {
    // Delete existing lines and re-insert
    await supabase.from('estimate_lines').delete().eq('estimate_id', id)

    // Recalculate totals
    const laborTotal = body.lines.reduce((s: number, l: any) => s + (parseFloat(l.labor_total) || 0), 0)
    const partsTotal = body.lines.reduce((s: number, l: any) => s + (parseFloat(l.parts_total) || 0), 0)
    const subtotal = laborTotal + partsTotal

    // Get tax rate
    const { data: shop } = await supabase.from('shops').select('tax_rate').eq('id', estimate.shop_id).single()
    const taxRate = shop?.tax_rate || 0
    const taxAmount = Math.round(subtotal * taxRate) / 100
    const total = subtotal + taxAmount

    await supabase.from('estimates').update({
      labor_total: laborTotal, parts_total: partsTotal, subtotal, tax_amount: taxAmount, total,
    }).eq('id', id)

    const lineRows = body.lines.map((l: any, i: number) => ({
      estimate_id: id,
      repair_order_line_id: l.repair_order_line_id || null,
      description: l.description || '',
      complaint: l.complaint || null,
      labor_hours: parseFloat(l.labor_hours) || 0,
      labor_rate: parseFloat(l.labor_rate) || 0,
      labor_total: parseFloat(l.labor_total) || 0,
      parts_total: parseFloat(l.parts_total) || 0,
      line_total: parseFloat(l.line_total) || 0,
      is_approved: l.is_approved ?? null,
      customer_response: l.customer_response || null,
      line_number: i + 1,
    }))
    await supabase.from('estimate_lines').insert(lineRows)
  }

  return NextResponse.json(estimate)
}
