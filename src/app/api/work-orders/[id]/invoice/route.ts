/**
 * TruckZen — Original Design
 * Invoice workflow: draft → quality_check → accounting_review → sent → paid → closed
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const actorShopId = getActorShopId(actor)
  if (!actorShopId) return jsonError('No shop context', 400)
  const user_id = actor.id

  const { id } = await params
  const s = db()
  const { action, ...data } = await req.json()

  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  const { data: wo } = await s.from('service_orders').select('id, invoice_status, shop_id, so_number, customer_id').eq('id', id).single()
  if (!wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

  // Guard invoice status transitions
  const VALID_INVOICE_TRANSITIONS: Record<string, string[]> = {
    submit_to_accounting: [null, '', 'draft', 'quality_check_failed'].map(v => v ?? ''),
    approve_invoicing: ['accounting_review', 'pending_accounting', 'accounting_approved'],
    mark_paid: ['sent', 'sent_to_customer'],
    close_wo: ['paid'],
  }
  const currentInvoiceStatus = wo.invoice_status || ''
  const allowedFrom = VALID_INVOICE_TRANSITIONS[action]
  if (allowedFrom && !allowedFrom.includes(currentInvoiceStatus)) {
    return NextResponse.json({ error: `Cannot "${action}" when invoice_status is "${currentInvoiceStatus || 'none'}"` }, { status: 400 })
  }

  // Submit to accounting (direct — no quality check step)
  if (action === 'submit_to_accounting') {
    const { data: lines } = await s.from('so_lines').select('id, line_status, parts_status, real_name, rough_name, customer_provides_parts, line_type').eq('so_id', id)
    const jobs = (lines || []).filter(l => l.line_type === 'labor')
    const parts = (lines || []).filter(l => (l.rough_name || l.real_name) && l.parts_status !== 'canceled')

    const issues: string[] = []
    const incompleteJobs = jobs.filter(j => j.line_status !== 'completed')
    if (incompleteJobs.length > 0) issues.push(`${incompleteJobs.length} job(s) not completed`)

    const roughParts = parts.filter(p => !p.customer_provides_parts && (!p.real_name && p.rough_name))
    if (roughParts.length > 0) issues.push(`${roughParts.length} part(s) still have rough names`)

    if (issues.length > 0) return NextResponse.json({ error: 'Cannot submit', issues }, { status: 400 })

    await s.from('service_orders').update({ invoice_status: 'accounting_review' }).eq('id', id)
    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: 'Submitted to accounting' })

    // Notify accounting team — bell + queue
    try {
      const { createNotification } = await import('@/lib/createNotification')
      const { getUserIdsByRole } = await import('@/lib/createNotification')
      const acctUsers = await getUserIdsByRole(wo.shop_id, ['owner', 'gm', 'accountant', 'accounting_manager', 'office_admin'])
      if (acctUsers.length > 0) {
        await createNotification({
          shopId: wo.shop_id,
          recipientId: acctUsers,
          type: 'invoice_submitted',
          title: 'Invoice Ready for Review',
          body: `${wo.so_number || id.slice(0, 6)} submitted to accounting`,
          link: `/accounting`,
          relatedWoId: id,
        })
      }
    } catch {}

    return NextResponse.json({ ok: true })
  }

  // Approve for invoicing (accounting) — must create invoice row before advancing to sent
  if (action === 'approve_invoicing') {
    // Fetch lines for invoice generation
    const { data: allLines } = await s.from('so_lines')
      .select('id, line_type, description, real_name, quantity, unit_price, total_price, parts_status, parts_sell_price, parts_cost_price, billed_hours, estimated_hours, actual_hours')
      .eq('so_id', id)

    const { data: shop } = await s.from('shops').select('tax_rate, tax_labor, labor_rate, default_labor_rate').eq('id', wo.shop_id).single()
    const taxRate = shop?.tax_rate || 0
    const laborRate = shop?.labor_rate || shop?.default_labor_rate || 125

    const lines = allLines || []
    // Calculate totals using the same logic as accounting/approve
    const { calcWoOperationalTotals } = await import('@/lib/invoice-calc')
    const { laborTotal, partsTotal, subtotal, taxAmount, grandTotal: total } = calcWoOperationalTotals(lines, laborRate, taxRate, !!shop?.tax_labor)

    // Snapshot labor rate onto labor lines
    for (const l of lines) {
      if (l.line_type === 'labor' && (l.unit_price || 0) !== laborRate) {
        await s.from('so_lines').update({ unit_price: laborRate }).eq('id', l.id)
      }
    }

    // Update WO totals
    await s.from('service_orders').update({ labor_total: laborTotal, parts_total: partsTotal, grand_total: total }).eq('id', id)

    // Create invoice row if not exists
    const { data: existingInv } = await s.from('invoices').select('id').eq('so_id', id).limit(1).single()
    if (!existingInv) {
      const { count } = await s.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', wo.shop_id).is('deleted_at', null)
      const year = new Date().getFullYear()
      const invNum = `INV-${year}-${String((count || 0) + 1).padStart(4, '0')}`
      await s.from('invoices').insert({
        shop_id: wo.shop_id, so_id: id, customer_id: wo.customer_id || null,
        invoice_number: invNum, status: 'sent',
        subtotal, tax_rate: taxRate, tax_amount: taxAmount, total,
        balance_due: total, amount_paid: 0,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      })
    } else {
      await s.from('invoices').update({ status: 'sent', subtotal, tax_amount: taxAmount, total, balance_due: total }).eq('id', existingInv.id)
    }

    await s.from('service_orders').update({
      invoice_status: 'sent',
      accounting_approved_by: user_id,
      accounting_approved_at: new Date().toISOString(),
    }).eq('id', id)
    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: 'Invoice approved and sent' })
    return NextResponse.json({ ok: true })
  }

  // Mark as paid
  if (action === 'mark_paid') {
    const now = new Date().toISOString()
    await s.from('service_orders').update({
      invoice_status: 'paid',
      payment_date: now,
    }).eq('id', id)

    // Also update the invoice row
    const { data: inv } = await s.from('invoices').select('id, total').eq('so_id', id).limit(1).single()
    if (inv) {
      await s.from('invoices').update({
        status: 'paid',
        amount_paid: inv.total || 0,
        balance_due: 0,
        paid_at: now,
      }).eq('id', inv.id)
    }

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

    // Update truck odometer on WO close (only if new reading is higher)
    const { data: fullWo } = await s.from('service_orders').select('mileage_at_service, asset_id').eq('id', id).single()
    if (fullWo?.mileage_at_service && fullWo.asset_id) {
      await s.from('assets').update({ odometer: fullWo.mileage_at_service }).eq('id', fullWo.asset_id).lt('odometer', fullWo.mileage_at_service)
    }

    await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: 'Work order closed' })
    return NextResponse.json({ ok: true })
  }

  // Update line prices (accounting) — only during accounting_review
  if (action === 'update_line') {
    if (['sent', 'paid', 'closed'].includes(currentInvoiceStatus)) {
      return NextResponse.json({ error: 'Lines are locked — invoice has been sent to customer' }, { status: 403 })
    }
    const { line_id, ...updates } = data
    if (!line_id) return NextResponse.json({ error: 'line_id required' }, { status: 400 })
    const allowed = ['labor_rate', 'labor_hours', 'parts_sell_price', 'parts_cost_price', 'parts_quantity', 'misc_charge', 'misc_description', 'discount_amount', 'tax_rate', 'line_total']
    const safe: Record<string, any> = {}
    for (const k of allowed) { if (k in updates) safe[k] = updates[k] }
    await s.from('so_lines').update(safe).eq('id', line_id)
    return NextResponse.json({ ok: true })
  }

  // Reopen locked invoice for review
  if (action === 'reopen') {
    const reopenRoles = ['owner', 'gm', 'it_person', 'accountant', 'accounting_manager', 'office_admin']
    if (!reopenRoles.includes(actor.role) && !actor.is_platform_owner) {
      return NextResponse.json({ error: 'Only accounting/admin can reopen invoices' }, { status: 403 })
    }
    if (!['sent', 'paid', 'closed'].includes(currentInvoiceStatus)) {
      return NextResponse.json({ error: 'Invoice is not in a locked state' }, { status: 400 })
    }
    await s.from('service_orders').update({ invoice_status: 'accounting_review', updated_at: new Date().toISOString() }).eq('id', id)
    await s.from('wo_activity_log').insert({ wo_id: id, user_id: user_id, action: `Invoice reopened for review (was ${currentInvoiceStatus})` })
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
  const parts = (lines || []).filter(l => (l.rough_name || l.real_name) && l.parts_status !== 'canceled')

  const checks = [
    { label: 'All jobs completed', passed: jobs.every(j => j.line_status === 'completed'), detail: `${jobs.filter(j => j.line_status === 'completed').length} of ${jobs.length} done` },
    { label: 'All parts received', passed: parts.filter(p => !p.customer_provides_parts).every(p => !p.parts_status || ['received', 'ready_for_job', 'installed'].includes(p.parts_status)), detail: `${parts.filter(p => ['received', 'ready_for_job', 'installed'].includes(p.parts_status || '')).length} of ${parts.length} received` },
    { label: 'All parts have real names', passed: parts.filter(p => !p.customer_provides_parts).every(p => p.real_name || !p.rough_name), detail: `${parts.filter(p => p.real_name).length} of ${parts.filter(p => p.rough_name).length} sourced` },
  ]

  return NextResponse.json({ checks, allPassed: checks.every(c => c.passed) })
}
