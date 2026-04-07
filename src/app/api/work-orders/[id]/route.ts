import { NextResponse } from 'next/server'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { workStartedEmail } from '@/lib/emails/workStarted'

import { logAction } from '@/lib/services/auditLog'
import { deriveWOAutomation, deriveLineAutomation } from '@/lib/wo-automation'
import { deriveWOETC } from '@/lib/wo-etc'
import { deriveWOAlerts, alertDedupKey } from '@/lib/wo-alerts'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!

  // Stage 1: Verify WO exists with a simple query (no joins that can fail)
  const { data: base, error: baseError } = await ctx.admin
    .from('service_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (baseError || !base) {
    return NextResponse.json({ error: 'Work order not found', detail: baseError?.message || null }, { status: 404 })
  }
  if (!ctx.actor.is_platform_owner && base.shop_id !== ctx.shopId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Stage 2: Fetch related data with individual queries (resilient to missing FKs)
  const [
    { data: asset },
    { data: customer },
    { data: assignedTech },
    { data: soLines },
    { data: estimates },
    { data: invoices },
    { data: woNotes },
    { data: woFiles },
    { data: activityLog },
    { data: shopCharges },
    { data: shop },
    { data: woParts },
  ] = await Promise.all([
    base.asset_id
      ? ctx.admin.from('assets').select('id, unit_number, year, make, model, vin, odometer, engine, ownership_type, is_owner_operator, owner_name, owner_phone, driver_name, driver_phone, lease_info, asset_status').eq('id', base.asset_id).single()
      : Promise.resolve({ data: null }),
    base.customer_id
      ? ctx.admin.from('customers').select('id, company_name, contact_name, phone, email, address').eq('id', base.customer_id).single()
      : Promise.resolve({ data: null }),
    base.assigned_tech
      ? ctx.admin.from('users').select('id, full_name, role, team').eq('id', base.assigned_tech).single()
      : Promise.resolve({ data: null }),
    ctx.admin.from('so_lines').select('id, so_id, line_type, description, part_number, quantity, unit_price, total_price, created_at, assigned_to, finding, resolution, estimated_hours, actual_hours, billed_hours, line_status, required_skills, labor_rate, approval_status, approval_required, approved_by, approved_at, approval_notes, rough_parts, real_name, rough_name, parts_status, parts_cost_price, parts_sell_price, related_labor_line_id').eq('so_id', id),
    ctx.admin.from('estimates').select('id, estimate_number, status, total, subtotal, tax_amount, customer_email, customer_phone, approval_method, approved_at, customer_notes, sent_at').eq('wo_id', id),
    ctx.admin.from('invoices').select('id, invoice_number, status, total, balance_due, amount_paid, due_date').eq('so_id', id),
    ctx.admin.from('wo_notes').select('id, user_id, note_text, visible_to_customer, created_at').eq('wo_id', id),
    ctx.admin.from('wo_files').select('id, user_id, file_url, filename, caption, visible_to_customer, created_at').eq('wo_id', id),
    ctx.admin.from('wo_activity_log').select('id, user_id, action, created_at').eq('wo_id', id),
    ctx.admin.from('wo_shop_charges').select('id, description, amount, taxable, created_at').eq('wo_id', id),
    ctx.admin.from('shops').select('tax_rate, tax_labor, state, county, name, labor_rate, default_labor_rate, dba, phone, email, address, payment_payee_name, payment_bank_name, payment_ach_account, payment_ach_routing, payment_wire_account, payment_wire_routing, payment_zelle_email_1, payment_zelle_email_2, payment_mail_payee, payment_mail_address, payment_mail_address_2, payment_mail_city, payment_mail_state, payment_mail_zip, payment_note').eq('id', base.shop_id).single(),
    ctx.admin.from('wo_parts').select('*').eq('wo_id', id).order('created_at'),
  ])

  // Assemble WO object matching previous shape
  const wo: any = {
    ...base,
    assets: asset || null,
    customers: customer || null,
    users: assignedTech || null,
    so_lines: soLines || [],
    estimates: estimates || [],
    invoices: invoices || [],
    wo_notes: woNotes || [],
    wo_files: woFiles || [],
    wo_activity_log: activityLog || [],
    wo_shop_charges: shopCharges || [],
  }

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
    const { data: ja, error: jaErr } = await ctx.admin.from('wo_job_assignments').select('*').in('line_id', lineIds).order('created_at')
    if (jaErr) {
      // Table may not exist yet — return empty rather than failing
      jobAssignments = []
    } else {
      // Resolve user names separately (avoids FK join requirement)
      const assignUserIds = [...new Set((ja || []).map((a: any) => a.user_id).filter(Boolean))]
      let assignUserMap: Record<string, { full_name: string; team: string | null }> = {}
      if (assignUserIds.length > 0) {
        const { data: aUsers } = await ctx.admin.from('users').select('id, full_name, team').in('id', assignUserIds)
        if (aUsers) assignUserMap = Object.fromEntries(aUsers.map((u: any) => [u.id, { full_name: u.full_name, team: u.team }]))
      }
      jobAssignments = (ja || []).map((a: any) => ({
        ...a,
        users: assignUserMap[a.user_id] ? { id: a.user_id, full_name: assignUserMap[a.user_id].full_name, team: assignUserMap[a.user_id].team } : null,
      }))
    }
  }

  // Fetch time entries for ETC
  const { data: timeEntries } = await ctx.admin.from('so_time_entries')
    .select('id, user_id, so_line_id, duration_minutes, clocked_in_at, clocked_out_at')
    .eq('service_order_id', id)
    .is('deleted_at', null)

  // Derive automation visibility
  const automation = deriveWOAutomation(wo)
  const lineAutomation: Record<string, any> = {}
  for (const line of wo.so_lines || []) {
    lineAutomation[line.id] = deriveLineAutomation(line)
  }
  const etc = deriveWOETC(wo, timeEntries || [])

  // Resolve service writer name
  let service_writer_name = null
  if (wo.service_writer_id) {
    const { data: sw } = await ctx.admin.from('users').select('full_name').eq('id', wo.service_writer_id).single()
    service_writer_name = sw?.full_name || null
  }

  return NextResponse.json({ ...wo, shop, techMap, userMap, createdByName, service_writer_name, jobAssignments, woParts: woParts || [], automation, lineAutomation, etc })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: existing } = await getWorkOrderForActor(ctx.admin, ctx.actor, id, 'id, shop_id, so_number, status, invoice_status, assigned_tech, customer_id, asset_id, portal_token, is_historical')
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if ((existing as any).is_historical) {
    return NextResponse.json({ error: 'Historical Fullbay records are read-only' }, { status: 403 })
  }

  const body = await req.json()
  const allowedFields = ['status', 'priority', 'team', 'bay', 'assigned_tech', 'complaint', 'cause', 'correction', 'internal_notes', 'customer_id', 'grand_total', 'due_date', 'service_writer_id', 'parts_person_id', 'customer_contact_name', 'customer_contact_phone', 'fleet_contact_name', 'fleet_contact_phone', 'po_number', 'estimate_date', 'promised_date', 'estimate_approved', 'estimate_status', 'approval_method', 'estimate_declined_reason', 'customer_estimate_notes', 'submitted_at']
  const update: Record<string, any> = {}
  for (const f of allowedFields) if (body[f] !== undefined) update[f] = body[f]
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  // Guard WO status transitions (skip for historical/imported WOs)
  if (update.status && !(existing as any).is_historical) {
    const VALID_WO_TRANSITIONS: Record<string, string[]> = {
      draft: ['in_progress', 'waiting_approval', 'void'],
      waiting_approval: ['in_progress', 'draft', 'void'],
      in_progress: ['waiting_parts', 'done', 'completed', 'void'],
      waiting_parts: ['in_progress', 'void'],
      completed: ['good_to_go', 'in_progress', 'void'],
      done: ['good_to_go', 'in_progress', 'void'],
      good_to_go: ['void'],
    }
    const currentStatus = (existing as any).status || 'draft'
    const allowed = VALID_WO_TRANSITIONS[currentStatus]
    if (allowed && !allowed.includes(update.status)) {
      return NextResponse.json({ error: `Cannot transition from "${currentStatus}" to "${update.status}"` }, { status: 400 })
    }
  }

  update.updated_at = new Date().toISOString()
  if (update.status === 'good_to_go' && (existing as any).status !== 'good_to_go') update.completed_at = new Date().toISOString()
  // Auto-queue for accounting when WO reaches done (if not already in invoice flow)
  if (update.status === 'done' && !(existing as any).invoice_status) update.invoice_status = 'accounting_review'

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

      // Workflow automation alerts (deduped by type+WO)
      const postAutomation = deriveWOAutomation(data)
      const alerts = deriveWOAlerts(postAutomation, data)
      for (const alert of alerts) {
        const dedupLink = alertDedupKey(id, alert.type)
        // Check for existing notification with same link+type to avoid duplicates
        const { data: existing_notif } = await ctx.admin.from('notifications')
          .select('id').eq('shop_id', data.shop_id).eq('type', alert.type).eq('link', dedupLink).eq('is_read', false).limit(1)
        if (existing_notif && existing_notif.length > 0) continue // already alerted
        const recipients = await getUserIdsByRole(data.shop_id, alert.targetRoles)
        if (recipients.length > 0) {
          await createNotification({
            shopId: data.shop_id, recipientId: recipients, type: alert.type,
            title: alert.title, body: alert.body, link: `/work-orders/${id}`,
            relatedWoId: id, priority: alert.priority,
          })
        }
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
          const { sendPaymentNotifications } = await import('@/lib/notifications/sendPaymentNotifications')
          await sendPaymentNotifications(wo.id, data.shop_id)
        }
      } catch {}
    })()
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'service_writer'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, id, 'id, shop_id, status, so_number, is_historical')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if ((wo as any).is_historical) {
    return NextResponse.json({ error: 'Historical Fullbay records are read-only' }, { status: 403 })
  }

  // Void is allowed from any status — soft delete + status change, preserves all records
  const now = new Date().toISOString()
  await ctx.admin.from('service_orders').update({ deleted_at: now, status: 'void', updated_at: now }).eq('id', id)
  await ctx.admin.from('wo_activity_log').insert({ wo_id: id, user_id: ctx.actor.id, action: `Voided work order (was: ${(wo as any).status})` })
  logAction({ shop_id: (wo as any).shop_id, user_id: ctx.actor.id, action: 'wo.voided', entity_type: 'service_order', entity_id: id, details: { so_number: (wo as any).so_number, previous_status: (wo as any).status } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
