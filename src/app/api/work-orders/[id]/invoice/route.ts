/**
 * TruckZen — Original Design
 * Invoice workflow: draft → quality_check → accounting_review → sent → paid → closed
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const { action, user_id, ...data } = await req.json()

  if (!action || !user_id) return NextResponse.json({ error: 'action and user_id required' }, { status: 400 })

  const { data: wo } = await s.from('service_orders').select('id, invoice_status, shop_id').eq('id', id).single()
  if (!wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

  // Submit to accounting (direct — no quality check step)
  if (action === 'submit_to_accounting') {
    const { data: lines } = await s.from('so_lines').select('id, line_status, parts_status, real_name, rough_name, customer_provides_parts, line_type').eq('so_id', id)
    const jobs = (lines || []).filter(l => l.line_type === 'labor')
    const parts = (lines || []).filter(l => l.rough_name || l.real_name)

    const issues: string[] = []
    const incompleteJobs = jobs.filter(j => j.line_status !== 'completed')
    if (incompleteJobs.length > 0) issues.push(`${incompleteJobs.length} job(s) not completed`)

    const roughParts = parts.filter(p => !p.customer_provides_parts && (!p.real_name && p.rough_name))
    if (roughParts.length > 0) issues.push(`${roughParts.length} part(s) still have rough names`)

    if (issues.length > 0) return NextResponse.json({ error: 'Cannot submit', issues }, { status: 400 })

    await s.from('service_orders').update({ invoice_status: 'accounting_review' }).eq('id', id)
    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: 'Submitted to accounting' })
    return NextResponse.json({ ok: true })
  }

  // Approve for invoicing (accounting)
  if (action === 'approve_invoicing') {
    await s.from('service_orders').update({ invoice_status: 'sent' }).eq('id', id)
    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: 'Invoice approved and sent' })
    return NextResponse.json({ ok: true })
  }

  // Mark as paid
  if (action === 'mark_paid') {
    await s.from('service_orders').update({
      invoice_status: 'paid',
      payment_date: new Date().toISOString(),
    }).eq('id', id)
    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: 'Marked as paid' })
    return NextResponse.json({ ok: true })
  }

  // Close WO
  if (action === 'close_wo') {
    await s.from('service_orders').update({
      invoice_status: 'closed',
      status: 'good_to_go',
      closed_at: new Date().toISOString(),
      closed_by: user_id,
    }).eq('id', id)
    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: 'Work order closed' })
    return NextResponse.json({ ok: true })
  }

  // Update line prices (accounting)
  if (action === 'update_line') {
    const { line_id, ...updates } = data
    if (!line_id) return NextResponse.json({ error: 'line_id required' }, { status: 400 })
    const allowed = ['labor_rate', 'labor_hours', 'parts_sell_price', 'parts_cost_price', 'parts_quantity', 'misc_charge', 'misc_description', 'discount_amount', 'tax_rate', 'line_total']
    const safe: Record<string, any> = {}
    for (const k of allowed) { if (k in updates) safe[k] = updates[k] }
    await s.from('so_lines').update(safe).eq('id', line_id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// GET — check invoice readiness
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()

  const { data: lines } = await s.from('so_lines').select('id, line_type, line_status, parts_status, real_name, rough_name, customer_provides_parts, description').eq('so_id', id)
  const jobs = (lines || []).filter(l => l.line_type === 'labor')
  const parts = (lines || []).filter(l => l.rough_name || l.real_name)

  const checks = [
    { label: 'All jobs completed', passed: jobs.every(j => j.line_status === 'completed'), detail: `${jobs.filter(j => j.line_status === 'completed').length} of ${jobs.length} done` },
    { label: 'All parts received', passed: parts.filter(p => !p.customer_provides_parts).every(p => !p.parts_status || ['received', 'installed'].includes(p.parts_status)), detail: `${parts.filter(p => ['received', 'installed'].includes(p.parts_status || '')).length} of ${parts.length} received` },
    { label: 'All parts have real names', passed: parts.filter(p => !p.customer_provides_parts).every(p => p.real_name || !p.rough_name), detail: `${parts.filter(p => p.real_name).length} of ${parts.filter(p => p.rough_name).length} sourced` },
  ]

  return NextResponse.json({ checks, allPassed: checks.every(c => c.passed) })
}
