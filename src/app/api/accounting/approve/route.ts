import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getStaffEmails, getShopInfo } from '@/lib/services/email'
import { sendPushToUser, sendPushToRole } from '@/lib/services/notifications'
import { sendPaymentNotifications } from '@/lib/notifications/sendPaymentNotifications'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { wo_id, action, user_id, notes } = body

  if (!wo_id || !action || !['approve', 'return'].includes(action)) {
    return NextResponse.json({ error: 'wo_id and action (approve|return) required' }, { status: 400 })
  }

  // Fetch WO
  const { data: wo, error: woErr } = await s
    .from('service_orders')
    .select('id, so_number, shop_id, customer_id, asset_id, service_writer_id, invoice_status, so_lines(id, line_type, description, quantity, unit_price, total_price)')
    .eq('id', wo_id)
    .single()

  if (woErr || !wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

  if (action === 'approve') {
    // Set invoice_status to approved
    await s.from('service_orders').update({
      invoice_status: 'accounting_approved',
      accounting_approved_by: user_id,
      accounting_approved_at: new Date().toISOString(),
      accounting_notes: null,
      updated_at: new Date().toISOString(),
    }).eq('id', wo_id)

    // Auto-generate invoice if not exists
    const { data: existingInv } = await s.from('invoices')
      .select('id')
      .eq('so_id', wo_id)
      .limit(1)
      .single()

    if (!existingInv) {
      // Get shop tax settings
      const { data: shop } = await s.from('shops').select('tax_rate, tax_labor, labor_rate').eq('id', wo.shop_id).single()
      const taxRate = shop?.tax_rate || 0
      const laborRate = shop?.labor_rate || 125

      const lines = (wo as any).so_lines || []
      const laborTotal = lines
        .filter((l: any) => l.line_type === 'labor')
        .reduce((sum: number, l: any) => sum + ((l.total_price || 0) > 0 ? l.total_price : (l.quantity || 1) * laborRate), 0)
      const partsTotal = lines
        .filter((l: any) => l.line_type === 'part')
        .reduce((sum: number, l: any) => sum + (l.total_price || 0), 0)
      const subtotal = laborTotal + partsTotal
      const taxableAmount = partsTotal + (shop?.tax_labor ? laborTotal : 0)
      const taxAmount = taxableAmount * (taxRate / 100)
      const total = subtotal + taxAmount

      // Generate invoice number
      const { count } = await s.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', wo.shop_id).is('deleted_at', null)
      const year = new Date().getFullYear()
      const invNum = `INV-${year}-${String((count || 0) + 1).padStart(4, '0')}`

      await s.from('invoices').insert({
        shop_id: wo.shop_id,
        so_id: wo_id,
        customer_id: wo.customer_id,
        invoice_number: invNum,
        status: 'sent',
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        balance_due: total,
        amount_paid: 0,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      })
    } else {
      // Mark existing invoice as sent
      await s.from('invoices').update({ status: 'sent' }).eq('id', existingInv.id)
    }

    // Update status to sent_to_customer
    await s.from('service_orders').update({
      invoice_status: 'sent_to_customer',
      updated_at: new Date().toISOString(),
    }).eq('id', wo_id)

    // Log activity
    if (user_id) {
      await s.from('wo_activity_log').insert({ wo_id, user_id, action: 'Accounting approved invoice and sent to customer' })
    }

    // Send payment notifications to customer (email + SMS)
    sendPaymentNotifications(wo_id, wo.shop_id).catch(err => {
      console.error('[Accounting] Payment notification failed:', err)
    })

    // Notify service writer
    if (wo.service_writer_id) {
      sendPushToUser(wo.service_writer_id, 'Invoice Approved', `WO-${wo.so_number} invoice approved and sent to customer`).catch(() => {})
    }

    // In-app notification
    try {
      const { createNotification } = await import('@/lib/createNotification')
      if (wo.service_writer_id) {
        await createNotification({
          shopId: wo.shop_id, recipientId: wo.service_writer_id, type: 'invoice_approved',
          title: 'Invoice Approved', body: `WO-${wo.so_number} invoice approved — sent to customer`,
          link: `/work-orders/${wo_id}`, relatedWoId: wo_id, priority: 'normal',
        })
      }
    } catch {}

    return NextResponse.json({ success: true, action: 'approved' })
  }

  if (action === 'return') {
    await s.from('service_orders').update({
      invoice_status: 'draft',
      accounting_notes: notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', wo_id)

    // Log activity
    if (user_id) {
      await s.from('wo_activity_log').insert({ wo_id, user_id, action: `Accounting returned WO: ${notes || 'No notes'}` })
    }

    // Notify service writer
    if (wo.service_writer_id) {
      sendPushToUser(wo.service_writer_id, 'WO Returned by Accounting', `WO-${wo.so_number}: ${notes || 'Returned for revision'}`).catch(() => {})
    }

    return NextResponse.json({ success: true, action: 'returned' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
