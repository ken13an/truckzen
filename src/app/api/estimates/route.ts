/**
 * TruckZen — Original Design
 * Estimates API — create from WO, list, send, approve/decline
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const status = searchParams.get('status')
  const woId = searchParams.get('wo_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  let q = s.from('estimates').select('*, estimate_lines(*)').eq('shop_id', shopId).is('deleted_at', null).order('created_at', { ascending: false })
  if (status && status !== 'all') q = q.eq('status', status)
  if (woId) q = q.eq('wo_id', woId)
  const { data, error } = await q.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const s = db()
  const { action, ...body } = await req.json()

  if (action === 'create_from_wo') {
    const { shop_id, wo_id, user_id } = body
    if (!shop_id || !wo_id) return NextResponse.json({ error: 'shop_id and wo_id required' }, { status: 400 })

    const { data: wo } = await s.from('service_orders').select('*, customers(id, company_name, contact_name, email, phone), assets(id, unit_number, year, make, model)').eq('id', wo_id).single()
    if (!wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

    const { data: shop } = await s.from('shops').select('default_labor_rate, labor_rate, tax_rate, default_tax_rate').eq('id', shop_id).single()
    const laborRate = shop?.default_labor_rate || shop?.labor_rate || 125
    const taxRate = shop?.tax_rate || shop?.default_tax_rate || 0

    const { data: lines } = await s.from('so_lines').select('*').eq('so_id', wo_id)

    const { count } = await s.from('estimates').select('*', { count: 'exact', head: true }).eq('shop_id', shop_id).is('deleted_at', null)
    const estNum = `EST-${String((count || 0) + 1).padStart(5, '0')}`
    const cust = wo.customers as any
    const asset = wo.assets as any

    const { data: est, error } = await s.from('estimates').insert({
      shop_id, wo_id, estimate_number: estNum,
      customer_id: cust?.id || wo.customer_id, asset_id: asset?.id || wo.asset_id,
      customer_name: cust?.company_name, customer_email: cust?.email, customer_phone: cust?.phone,
      status: 'draft', tax_rate: taxRate, valid_until: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      created_by: user_id,
    }).select().single()

    if (error || !est) return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })

    const estLines: any[] = []
    for (const line of lines || []) {
      if (line.line_type === 'labor') {
        const hrs = line.estimated_hours || line.billed_hours || line.actual_hours || 1
        estLines.push({ estimate_id: est.id, line_type: 'labor', description: line.description, quantity: hrs, unit_price: laborRate, total: hrs * laborRate, so_line_id: line.id })
      } else if (line.line_type === 'part' && (line.real_name || line.rough_name)) {
        const price = line.parts_sell_price || line.unit_price || 0
        estLines.push({ estimate_id: est.id, line_type: 'part', description: line.real_name || line.rough_name, part_number: line.part_number, quantity: line.quantity || 1, unit_price: price, total: (line.quantity || 1) * price, so_line_id: line.id })
      }
    }
    if (estLines.length > 0) await s.from('estimate_lines').insert(estLines)

    const laborTotal = estLines.filter(l => l.line_type === 'labor').reduce((sum, l) => sum + l.total, 0)
    const partsTotal = estLines.filter(l => l.line_type === 'part').reduce((sum, l) => sum + l.total, 0)
    const sub = laborTotal + partsTotal
    const taxAmt = sub * (taxRate / 100)
    const grandTotal = sub + taxAmt

    await s.from('estimates').update({ labor_total: laborTotal, parts_total: partsTotal, subtotal: sub, tax_amount: taxAmt, grand_total: grandTotal, total: grandTotal }).eq('id', est.id)
    await s.from('service_orders').update({ estimate_id: est.id }).eq('id', wo_id)

    return NextResponse.json({ ...est, labor_total: laborTotal, parts_total: partsTotal, grand_total: grandTotal })
  }

  if (action === 'send') {
    const { id, email } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await s.from('estimates').update({ status: 'sent', sent_at: new Date().toISOString(), sent_to_email: email || null }).eq('id', id)
    const { data: est } = await s.from('estimates').select('wo_id').eq('id', id).single()
    if (est?.wo_id) await s.from('service_orders').update({ approval_status: 'pending_approval' }).eq('id', est.wo_id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'approve') {
    const { id, token, name } = body
    const { data: est } = await s.from('estimates').select('id, wo_id, approval_token').eq('id', id).single()
    if (!est || String(est.approval_token) !== String(token)) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    await s.from('estimates').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by_name: name || 'Customer' }).eq('id', id)
    if (est.wo_id) await s.from('service_orders').update({ estimate_approved: true, approval_status: 'approved' }).eq('id', est.wo_id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'decline') {
    const { id, token, reason } = body
    const { data: est } = await s.from('estimates').select('id, wo_id, approval_token').eq('id', id).single()
    if (!est || String(est.approval_token) !== String(token)) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    await s.from('estimates').update({ status: 'declined', declined_at: new Date().toISOString(), decline_reason: reason }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_lines') {
    const { estimate_id, lines } = body
    if (!estimate_id || !lines) return NextResponse.json({ error: 'estimate_id and lines required' }, { status: 400 })
    await s.from('estimate_lines').delete().eq('estimate_id', estimate_id)
    if (lines.length > 0) await s.from('estimate_lines').insert(lines.map((l: any) => ({ ...l, estimate_id })))
    const laborTotal = lines.filter((l: any) => l.line_type === 'labor').reduce((sum: number, l: any) => sum + (l.total || 0), 0)
    const partsTotal = lines.filter((l: any) => l.line_type === 'part').reduce((sum: number, l: any) => sum + (l.total || 0), 0)
    const miscTotal = lines.filter((l: any) => l.line_type === 'misc').reduce((sum: number, l: any) => sum + (l.total || 0), 0)
    const discTotal = lines.filter((l: any) => l.line_type === 'discount').reduce((sum: number, l: any) => sum + (l.total || 0), 0)
    const { data: est } = await s.from('estimates').select('tax_rate').eq('id', estimate_id).single()
    const sub = laborTotal + partsTotal + miscTotal - discTotal
    const taxAmt = sub * ((est?.tax_rate || 0) / 100)
    await s.from('estimates').update({ labor_total: laborTotal, parts_total: partsTotal, misc_total: miscTotal, discount_total: discTotal, subtotal: sub, tax_amount: taxAmt, grand_total: sub + taxAmt, total: sub + taxAmt, updated_at: new Date().toISOString() }).eq('id', estimate_id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
