import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { workStartedEmail } from '@/lib/emails/workStarted'
import { truckReadyEmail } from '@/lib/emails/truckReady'
import { logAction } from '@/lib/services/auditLog'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()

  const { data: wo, error } = await s
    .from('service_orders')
    .select(`
      *,
      assets(id, unit_number, year, make, model, vin, odometer, engine, ownership_type, is_owner_operator),
      customers(id, company_name, contact_name, phone, email, address),
      users!assigned_tech(id, full_name, role, team),
      so_lines(id, line_type, description, part_number, quantity, unit_price, total_price, created_at, assigned_to, finding, resolution, estimated_hours, actual_hours, billed_hours, line_status, required_skills, labor_rate, approval_status, approval_required, approved_by, approved_at, approval_notes, rough_parts),
      invoices(id, invoice_number, status, total, balance_due),
      wo_notes(id, user_id, note_text, visible_to_customer, created_at),
      wo_files(id, user_id, file_url, filename, caption, visible_to_customer, created_at),
      wo_activity_log(id, user_id, action, created_at),
      wo_shop_charges(id, description, amount, taxable, created_at)
    `)
    .eq('id', id)
    .single()

  if (error || !wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get shop tax settings
  const { data: shop } = await s.from('shops').select('tax_rate, tax_labor, state, county, name, labor_rate, default_labor_rate, dba, phone, email, address').eq('id', wo.shop_id).single()

  // Get wo_parts
  const { data: woParts } = await s.from('wo_parts').select('*').eq('wo_id', id).order('created_at')

  // Resolve creator name
  let createdByName = null
  if (wo.created_by_user_id) {
    const { data: creator } = await s.from('users').select('full_name').eq('id', wo.created_by_user_id).single()
    createdByName = creator?.full_name || null
  }

  // Resolve assigned_to names for job lines
  const techIds = (wo.so_lines || []).map((l: any) => l.assigned_to).filter(Boolean)
  let techMap: Record<string, string> = {}
  if (techIds.length > 0) {
    const { data: techs } = await s.from('users').select('id, full_name, team').in('id', techIds)
    if (techs) techMap = Object.fromEntries(techs.map((t: any) => [t.id, `${t.full_name} - Team ${t.team || '?'}`]))
  }

  // Resolve note/activity user names
  const allUserIds = [
    ...(wo.wo_notes || []).map((n: any) => n.user_id),
    ...(wo.wo_activity_log || []).map((a: any) => a.user_id),
    ...(wo.wo_files || []).map((f: any) => f.user_id),
  ].filter(Boolean)
  let userMap: Record<string, string> = {}
  if (allUserIds.length > 0) {
    const { data: users } = await s.from('users').select('id, full_name').in('id', [...new Set(allUserIds)])
    if (users) userMap = Object.fromEntries(users.map((u: any) => [u.id, u.full_name]))
  }

  // Get job assignments for all lines
  const lineIds = (wo.so_lines || []).map((l: any) => l.id)
  let jobAssignments: any[] = []
  if (lineIds.length > 0) {
    const { data: ja } = await s.from('wo_job_assignments').select('*, users(id, full_name, team)').in('line_id', lineIds).order('created_at')
    jobAssignments = ja || []
  }

  return NextResponse.json({ ...wo, shop, techMap, userMap, createdByName, jobAssignments, woParts: woParts || [] })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const body = await req.json()

  const allowedFields = ['status', 'priority', 'team', 'bay', 'assigned_tech', 'complaint', 'cause', 'correction', 'internal_notes', 'customer_id', 'grand_total', 'due_date', 'service_writer_id', 'parts_person_id', 'customer_contact_name', 'customer_contact_phone', 'fleet_contact_name', 'fleet_contact_phone', 'po_number', 'estimate_date', 'promised_date']
  const update: Record<string, any> = {}
  for (const f of allowedFields) { if (body[f] !== undefined) update[f] = body[f] }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  update.updated_at = new Date().toISOString()
  if (update.status === 'good_to_go' && body._old_status !== 'good_to_go') update.completed_at = new Date().toISOString()

  const { data, error } = await s.from('service_orders').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  if (body.user_id) {
    const changes = Object.keys(update).filter(k => k !== 'updated_at').join(', ')
    await s.from('wo_activity_log').insert({ wo_id: id, user_id: body.user_id, action: `Updated: ${changes}` })
  }

  // Fire and forget audit log
  if (update.status) {
    logAction({ shop_id: data.shop_id, user_id: body.user_id || '', action: 'wo.status_changed', entity_type: 'service_order', entity_id: id, details: { status: update.status } }).catch(() => {})
  }

  // Fire-and-forget in-app notifications on status change
  if (update.status && data.shop_id) {
    try {
      const { createNotification, getUserIdsByRole } = await import('@/lib/createNotification')
      if (update.status === 'good_to_go') {
        const mgrs = await getUserIdsByRole(data.shop_id, ['owner', 'gm', 'accounting_manager', 'accountant', 'office_admin'])
        if (mgrs.length > 0) await createNotification({ shopId: data.shop_id, recipientId: mgrs, type: 'wo_ready', title: `WO #${data.so_number} ready for pickup`, body: update.status, link: `/work-orders/${id}`, relatedWoId: id })
      }
      if (update.status === 'in_progress' && data.assigned_tech) {
        await createNotification({ shopId: data.shop_id, recipientId: data.assigned_tech, type: 'wo_started', title: `WO #${data.so_number} started`, body: 'Work order is now in progress', link: `/work-orders/${id}`, relatedWoId: id })
      }
    } catch (err) { console.error('Notification failed:', err) }
  }

  // Fire-and-forget email notifications on status change
  if (update.status === 'in_progress' || update.status === 'good_to_go') {
    ;(async () => {
      try {
        const { data: wo } = await s.from('service_orders')
          .select('id, so_number, shop_id, customer_id, asset_id, portal_token')
          .eq('id', id).single()
        if (!wo) return

        const { data: customer } = await s.from('customers')
          .select('email, contact_name, company_name, phone, sms_opted_out')
          .eq('id', wo.customer_id).single()
        if (!customer?.email && !customer?.phone) return

        const { data: asset } = await s.from('assets')
          .select('unit_number, year, make, model')
          .eq('id', wo.asset_id).single()

        const shop = await getShopInfo(wo.shop_id)
        const customerName = customer.contact_name || customer.company_name || 'Customer'
        const unitNumber = asset?.unit_number || ''
        const portalLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/${wo.portal_token}`

        if (update.status === 'in_progress') {
          const { subject, html } = workStartedEmail({
            customerName,
            unitNumber,
            year: String(asset?.year || ''),
            make: asset?.make || '',
            model: asset?.model || '',
            portalLink,
            shop,
          })
          await sendEmail(customer.email, subject, html)
        }

        if (update.status === 'good_to_go') {
          const { data: invoice } = await s.from('invoices')
            .select('id, invoice_number, total')
            .eq('wo_id', wo.id).order('created_at', { ascending: false }).limit(1).single()
          const payLink = invoice
            ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/${wo.portal_token}?pay=1`
            : portalLink
          const { subject, html } = truckReadyEmail({
            customerName,
            unitNumber,
            invoiceNumber: invoice?.invoice_number || '',
            amount: invoice ? String(invoice.total) : '0',
            payLink,
            shop,
          })
          await sendEmail(customer.email, subject, html)

          // Send SMS via Twilio if customer has a phone number
          if (customer.phone && !customer.sms_opted_out) {
            try {
              const { sendSMS } = await import('@/lib/integrations/twilio')
              const smsBody = `Your truck ${unitNumber} is ready for pickup at ${shop?.name || 'the shop'}. WO #${wo.so_number}. Call us: ${shop?.phone || ''}. Reply STOP to unsubscribe.`
              await sendSMS(customer.phone, smsBody.slice(0, 160))
            } catch {}
          }
        }
      } catch {}
    })()
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  const { data: wo } = await s.from('service_orders').select('shop_id').eq('id', id).single()
  await s.from('service_orders').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)

  if (wo && userId) {
    logAction({ shop_id: wo.shop_id, user_id: userId, action: 'soft_delete', entity_type: 'service_order', entity_id: id }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
