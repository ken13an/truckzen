import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPaymentNotifications } from '@/lib/notifications/sendPaymentNotifications'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { calcWoOperationalTotals } from '@/lib/invoice-calc'
import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

import { ACCOUNTING_ROLES } from '@/lib/roles'

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const actorShopId = getActorShopId(actor)
  if (!actorShopId) return jsonError('No shop context', 400)
  if (!ACCOUNTING_ROLES.includes(actor.impersonate_role || actor.role) && !(actor.is_platform_owner && !actor.impersonate_role)) return jsonError('Access denied', 403)

  const s = db()
  const body = await req.json()
  const { wo_id, action, notes } = body

  if (!wo_id || !action || !['approve', 'return'].includes(action)) {
    return NextResponse.json({ error: 'wo_id and action (approve|return) required' }, { status: 400 })
  }

  const { data: wo, error: woErr } = await s
    .from('service_orders')
    .select('id, so_number, shop_id, customer_id, asset_id, service_writer_id, invoice_status, ownership_type, assets(ownership_type)')
    .eq('id', wo_id)
    .eq('shop_id', actorShopId)
    .single()

  if (woErr || !wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

  if (action === 'approve') {
    // Fetch lines for invoice generation
    const { data: allLines } = await s.from('so_lines')
      .select('id, line_type, description, real_name, rough_name, quantity, unit_price, total_price, parts_status, parts_sell_price, parts_cost_price, billed_hours, estimated_hours, actual_hours')
      .eq('so_id', wo_id)

    const lines = allLines || []
    const { data: shop } = await s.from('shops').select('tax_rate, tax_labor, labor_rate, default_labor_rate').eq('id', wo.shop_id).single()
    const taxRate = shop?.tax_rate || 0

    // Labor rate from Settings → Labor Rates by ownership type
    const woOwnership = wo.ownership_type || (wo.assets as any)?.ownership_type || 'outside_customer'
    const { data: rateRow } = await s.from('shop_labor_rates').select('rate_per_hour').eq('shop_id', wo.shop_id).eq('ownership_type', woOwnership).single()
    const laborRate = rateRow?.rate_per_hour || shop?.labor_rate || shop?.default_labor_rate || DEFAULT_LABOR_RATE_FALLBACK

    const { laborTotal, partsTotal, subtotal, taxAmount, grandTotal: total } = calcWoOperationalTotals(lines, laborRate, taxRate, !!shop?.tax_labor)

    // Snapshot labor rate onto labor lines so email/PDF read correct unit_price
    // total_price is a generated column — do NOT write it directly
    for (const l of lines) {
      if (l.line_type === 'labor' && (l.unit_price || 0) !== laborRate) {
        await s.from('so_lines').update({ unit_price: laborRate }).eq('id', l.id)
      }
    }

    // Update WO totals
    await s.from('service_orders').update({
      labor_total: laborTotal,
      parts_total: partsTotal,
      grand_total: total,
      updated_at: new Date().toISOString(),
    }).eq('id', wo_id)

    // Auto-generate invoice if not exists
    const { data: existingInv } = await s.from('invoices')
      .select('id, amount_paid').eq('so_id', wo_id).limit(1).single()

    if (!existingInv) {
      const { count } = await s.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', wo.shop_id).is('deleted_at', null)
      const year = new Date().getFullYear()
      const invNum = `INV-${year}-${String((count || 0) + 1).padStart(4, '0')}`

      // invoices has no tax_rate column — shops.tax_rate is authoritative and
      // tax_amount already carries the computed amount. Writing tax_rate here
      // previously caused silent 42703 failures that let the flow continue
      // marking the WO sent while no invoice row existed.
      const { error: insertErr } = await s.from('invoices').insert({
        shop_id: wo.shop_id,
        so_id: wo_id,
        customer_id: wo.customer_id,
        invoice_number: invNum,
        status: 'sent',
        subtotal, tax_amount: taxAmount, total,
        balance_due: total, amount_paid: 0,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      })
      if (insertErr) {
        console.error('[accounting.approve] invoice insert failed', { wo_id, error: insertErr.message })
        return NextResponse.json({ error: 'Failed to create invoice: ' + insertErr.message }, { status: 500 })
      }
    } else {
      const priorPaid = existingInv.amount_paid || 0
      const { error: updateErr } = await s.from('invoices').update({
        status: 'sent', subtotal, tax_amount: taxAmount, total, balance_due: total - priorPaid,
      }).eq('id', existingInv.id)
      if (updateErr) {
        console.error('[accounting.approve] invoice update failed', { wo_id, invoiceId: existingInv.id, error: updateErr.message })
        return NextResponse.json({ error: 'Failed to update invoice: ' + updateErr.message }, { status: 500 })
      }
    }

    // Update WO invoice_status to sent (matches WO workflow truth)
    await s.from('service_orders').update({
      invoice_status: 'sent',
      accounting_approved_by: actor.id,
      accounting_approved_at: new Date().toISOString(),
      accounting_notes: null,
      updated_at: new Date().toISOString(),
    }).eq('id', wo_id)

    // Log activity
    await s.from('wo_activity_log').insert({
      wo_id, user_id: actor.id,
      action: 'Accounting approved and sent invoice to customer',
    })

    // Send payment notifications — awaited so the real email result surfaces
    // to the user instead of being silently dropped. DB-side "sent" flags
    // above are already committed, so email failure surfaces as a 200 + warning
    // payload rather than a 500 (which would misleadingly imply the whole
    // approve failed and the DB was not updated).
    let notifyResult: Awaited<ReturnType<typeof sendPaymentNotifications>> | null = null
    let emailWarning: string | undefined
    try {
      notifyResult = await sendPaymentNotifications(wo_id, wo.shop_id)
    } catch (err: any) {
      console.error('[Accounting] Payment notification threw:', err?.message || err)
      emailWarning = err?.message || 'unknown'
    }
    if (notifyResult && !notifyResult.emailOk) {
      console.error('[Accounting] Invoice email failed', { wo_id, emailError: notifyResult.emailError })
      emailWarning = notifyResult.emailError || 'unknown'
    }
    if (emailWarning) {
      console.error('[Accounting] Approve succeeded with email warning', { wo_id, emailWarning })
    }

    // Notify service writer
    if (wo.service_writer_id) {
      try {
        const { createNotification } = await import('@/lib/createNotification')
        await createNotification({
          shopId: wo.shop_id, recipientId: wo.service_writer_id, type: 'invoice_approved',
          title: 'Invoice Sent', body: `${wo.so_number} invoice approved and sent to customer`,
          link: `/work-orders/${wo_id}`, relatedWoId: wo_id,
        })
      } catch {}
    }

    return NextResponse.json(
      emailWarning
        ? { success: true, action: 'approved', warning: 'Invoice saved, but customer email failed', email_error: emailWarning }
        : { success: true, action: 'approved' }
    )
  }

  if (action === 'return') {
    await s.from('service_orders').update({
      invoice_status: 'draft',
      accounting_notes: notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', wo_id)

    await s.from('wo_activity_log').insert({
      wo_id, user_id: actor.id,
      action: `Accounting returned WO: ${notes || 'No notes'}`,
    })

    if (wo.service_writer_id) {
      try {
        const { createNotification } = await import('@/lib/createNotification')
        await createNotification({
          shopId: wo.shop_id, recipientId: wo.service_writer_id, type: 'invoice_returned',
          title: 'WO Returned', body: `${wo.so_number}: ${notes || 'Returned for revision'}`,
          link: `/work-orders/${wo_id}`, relatedWoId: wo_id,
        })
      } catch {}
    }

    return NextResponse.json({ success: true, action: 'returned' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
