import { NextResponse } from 'next/server'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { workStartedEmail } from '@/lib/emails/workStarted'
import { truckReadyEmail } from '@/lib/emails/truckReady'
import { logAction } from '@/lib/services/auditLog'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!

  const { data: wo, error } = await ctx.admin
    .from('service_orders')
    .select(`
      *,
      assets(id, unit_number, year, make, model, vin, odometer, engine, ownership_type, is_owner_operator, owner_name, owner_phone, driver_name, driver_phone, lease_info, asset_status),
      customers(id, company_name, contact_name, phone, email, address),
      users!assigned_tech(id, full_name, role, team),
      so_lines(id, so_id, line_type, description, part_number, quantity, unit_price, total_price, created_at, assigned_to, finding, resolution, estimated_hours, actual_hours, billed_hours, line_status, required_skills, labor_rate, approval_status, approval_required, approved_by, approved_at, approval_notes, rough_parts, real_name, rough_name, parts_status, parts_cost_price, parts_sell_price),
      estimates(id, estimate_number, status, total, subtotal, tax_amount, customer_email, customer_phone, approval_method, approved_at, customer_notes, sent_at),
      invoices(id, invoice_number, status, total, balance_due),
      wo_notes(id, user_id, note_text, visible_to_customer, created_at),
      wo_files(id, user_id, file_url, filename, caption, visible_to_customer, created_at),
      wo_activity_log(id, user_id, action, created_at),
      wo_shop_charges(id, description, amount, taxable, created_at)
    `)
    .eq('id', id)
    .single()

  if (error || !wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!ctx.actor.is_platform_owner && wo.shop_id !== ctx.shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: shop } = await ctx.admin.from('shops').select('tax_rate, tax_labor, state, county, name, labor_rate, default_labor_rate, dba, phone, email, address').eq('id', wo.shop_id).single()
  const { data: woParts } = await ctx.admin.from('wo_parts').select('*').eq('wo_id', id).order('created_at')

  let createdByName = null
  if (wo.created_by_user_id) {
    const { data: creator } = await ctx.admin.from('users').select('full_name').eq('id', wo.created_by_user_id).single()
    createdByName = creator?.full_name || null
  }

  const techIds = (wo.so_lines || []).map((l: any) => l.assigned_to).filter(Boolean)
  let techMap: Record<string, string> = {}
  if (techIds.length > 0) {
    const { data: techs } = await ctx.admin.from('users').select('id, full_name, team').in('id', techIds)
    if (techs) techMap = Object.fromEntries(techs.map((t: any) => [t.id, `${t.full_name} - Team ${t.team || '?'}`]))
  }

  const allUserIds = [
    ...(wo.wo_notes || []).map((n: any) => n.user_id),
    ...(wo.wo_activity_log || []).map((a: any) => a.user_id),
    ...(wo.wo_files || []).map((f: any) => f.user_id),
  ].filter(Boolean)
  let userMap: Record<string, string> = {}
  if (allUserIds.length > 0) {
    const { data: users } = await ctx.admin.from('users').select('id, full_name').in('id', [...new Set(allUserIds)])
    if (users) userMap = Object.fromEntries(users.map((u: any) => [u.id, u.full_name]))
  }

  const lineIds = (wo.so_lines || []).map((l: any) => l.id)
  let jobAssignments: any[] = []
  if (lineIds.length > 0) {
    const { data: ja } = await ctx.admin.from('wo_job_assignments').select('*, users(id, full_name, team)').in('line_id', lineIds).order('created_at')
    jobAssignments = ja || []
  }

  return NextResponse.json({ ...wo, shop, techMap, userMap, createdByName, jobAssignments, woParts: woParts || [] })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: existing } = await getWorkOrderForActor(ctx.admin, ctx.actor, id, 'id, shop_id, so_number, assigned_tech, customer_id, asset_id, portal_token')
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const allowedFields = ['status', 'priority', 'team', 'bay', 'assigned_tech', 'complaint', 'cause', 'correction', 'internal_notes', 'customer_id', 'grand_total', 'due_date', 'service_writer_id', 'parts_person_id', 'customer_contact_name', 'customer_contact_phone', 'fleet_contact_name', 'fleet_contact_phone', 'po_number', 'estimate_date', 'promised_date', 'estimate_approved', 'estimate_status', 'approval_method', 'estimate_declined_reason', 'customer_estimate_notes', 'submitted_at']
  const update: Record<string, any> = {}
  for (const f of allowedFields) if (body[f] !== undefined) update[f] = body[f]
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  update.updated_at = new Date().toISOString()
  if (update.status === 'good_to_go' && body._old_status !== 'good_to_go') update.completed_at = new Date().toISOString()

  const { data, error } = await ctx.admin.from('service_orders').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const changes = Object.keys(update).filter(k => k !== 'updated_at').join(', ')
  await ctx.admin.from('wo_activity_log').insert({ wo_id: id, user_id: ctx.actor.id, action: `Updated: ${changes}` }).then(() => {})
  if (update.status) {
    logAction({ shop_id: data.shop_id, user_id: ctx.actor.id, action: 'wo.status_changed', entity_type: 'service_order', entity_id: id, details: { status: update.status } }).catch(() => {})
  }

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
    } catch {}
  }

  if (update.status === 'in_progress' || update.status === 'good_to_go') {
    ;(async () => {
      try {
        const wo: any = existing
        const { data: customer } = await ctx.admin.from('customers').select('email, contact_name, company_name, phone, sms_opted_out').eq('id', wo.customer_id).single()
        if (!customer?.email && !customer?.phone) return
        const { data: asset } = await ctx.admin.from('assets').select('unit_number, year, make, model').eq('id', wo.asset_id).single()
        const shop = await getShopInfo(data.shop_id)
        const customerName = customer.contact_name || customer.company_name || 'Customer'
        const unitNumber = asset?.unit_number || ''
        const portalLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/${wo.portal_token}`
        if (update.status === 'in_progress') {
          const { subject, html } = workStartedEmail({ customerName, unitNumber, year: String(asset?.year || ''), make: asset?.make || '', model: asset?.model || '', portalLink, shop })
          await sendEmail(customer.email, subject, html)
        }
        if (update.status === 'good_to_go') {
          const { data: invoice } = await ctx.admin.from('invoices').select('id, invoice_number, total').eq('wo_id', wo.id).order('created_at', { ascending: false }).limit(1).single()
          const payLink = invoice ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/${wo.portal_token}?pay=1` : portalLink
          const { subject, html } = truckReadyEmail({ customerName, unitNumber, invoiceNumber: invoice?.invoice_number || '', amount: invoice ? String(invoice.total) : '0', payLink, shop })
          await sendEmail(customer.email, subject, html)
          if (customer.phone && !customer.sms_opted_out) {
            try {
              const { sendSMS } = await import('@/lib/integrations/twilio')
              const smsBody = `Your truck ${unitNumber} is ready for pickup at ${shop?.name || 'the shop'}. WO #${data.so_number}. Call us: ${shop?.phone || ''}. Reply STOP to unsubscribe.`
              await sendSMS(customer.phone, smsBody.slice(0, 160))
            } catch {}
          }
        }
      } catch {}
    })()
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, id, 'id, shop_id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await ctx.admin.from('service_orders').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
  logAction({ shop_id: (wo as any).shop_id, user_id: ctx.actor.id, action: 'soft_delete', entity_type: 'service_order', entity_id: id }).catch(() => {})
  return NextResponse.json({ ok: true })
}
