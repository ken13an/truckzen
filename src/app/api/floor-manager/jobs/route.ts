import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { deriveLineAutomation } from '@/lib/wo-automation'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = db()

  // Get all job lines with assignments, WO info, customer, unit
  const { data: lines } = await s.from('so_lines')
    .select(`id, description, line_status, estimated_hours, actual_hours, required_skills, line_type, assigned_to, parts_status,
      service_orders!inner(id, so_number, status, shop_id, customer_id, asset_id,
        estimate_required, estimate_approved, estimate_status, invoice_status,
        customers(company_name),
        assets(unit_number, unit_type, ownership_type)
      )`)
    .eq('service_orders.shop_id', shopId)
    .in('line_type', ['labor', 'job'])
    .not('service_orders.status', 'in', '("good_to_go","done","void")')
    .or('service_orders.is_historical.is.null,service_orders.is_historical.eq.false')
    .order('created_at', { ascending: false })
    .limit(200)

  // Get assignments from canonical source: wo_job_assignments
  const lineIds = (lines || []).map((l: any) => l.id)
  let woAssignments: any[] = []
  if (lineIds.length > 0) {
    const { data: wja } = await s.from('wo_job_assignments')
      .select('*, users:user_id(full_name, team)')
      .in('line_id', lineIds)
    woAssignments = wja || []
  }

  // Build response
  const jobs = (lines || []).map((line: any) => {
    const wo = line.service_orders
    const wja = woAssignments.find((a: any) => a.line_id === line.id)
    const mechanic = wja?.users || null
    const lineAuto = deriveLineAutomation(line)
    return {
      id: line.id,
      assignment_id: wja?.id || null,
      description: line.description,
      status: wja?.status || line.line_status || 'pending',
      estimated_hours: line.estimated_hours,
      required_skills: line.required_skills || [],
      wo_id: wo?.id,
      wo_number: wo?.so_number,
      wo_status: wo?.status || '',
      wo_estimate_required: wo?.estimate_required || false,
      wo_estimate_approved: wo?.estimate_approved || false,
      wo_invoice_status: wo?.invoice_status || '',
      customer: wo?.customers?.company_name || '',
      unit_number: wo?.assets?.unit_number || '',
      unit_type: wo?.assets?.unit_type || 'tractor',
      ownership_type: wo?.assets?.ownership_type || 'fleet_asset',
      mechanic_name: mechanic?.full_name || null,
      mechanic_team: mechanic?.team || null,
      assigned_to: line.assigned_to || null,
      automation: lineAuto,
    }
  })

  return NextResponse.json(jobs)
}

export async function PATCH(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = db()
  const { id, status, assignment_id } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

  // Update assignment timestamp if exists
  if (assignment_id) {
    await s.from('wo_job_assignments').update({ updated_at: new Date().toISOString() }).eq('id', assignment_id)
  }
  // Also update so_lines line_status
  const lineStatusMap: Record<string, string> = { pending: 'unassigned', accepted: 'in_progress', in_progress: 'in_progress', completed: 'completed' }
  await s.from('so_lines').update({ line_status: lineStatusMap[status] || status }).eq('id', id)

  // Diagnostic complete notification: if job marked completed on OO/outside diagnostic WO
  if (status === 'completed') {
    try {
      const { data: line } = await s.from('so_lines').select('so_id').eq('id', id).single()
      if (line?.so_id) {
        const { data: wo } = await s.from('service_orders').select('id, so_number, job_type, ownership_type, shop_id, assets(unit_number)').eq('id', line.so_id).single()
        if (wo && ['diagnostic', 'full_inspection'].includes(wo.job_type) && ['owner_operator', 'outside_customer'].includes(wo.ownership_type)) {
          // Create notification for service writers
          const { data: writers } = await s.from('users').select('id').eq('shop_id', wo.shop_id).in('role', ['service_writer', 'owner', 'gm']).or('is_autobot.is.null,is_autobot.eq.false')
          const unitNum = (wo.assets as any)?.unit_number || ''
          for (const w of (writers || [])) {
            await s.from('notifications').insert({
              user_id: w.id, shop_id: wo.shop_id, type: 'findings_needed',
              title: 'Diagnostic Complete — Add Findings',
              message: `Diagnostic complete — WO #${wo.so_number} #${unitNum} — add findings and build estimate`,
              link: `/work-orders/${wo.id}`,
            })
          }
        }
      }
    } catch {} // non-blocking
  }

  return NextResponse.json({ ok: true })
}
