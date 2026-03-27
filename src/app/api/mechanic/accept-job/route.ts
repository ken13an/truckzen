import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { sendPaymentNotifications } from '@/lib/notifications/sendPaymentNotifications'
import { makeCompletionCalls } from '@/lib/notifications/makeCompletionCalls'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = db()
  const { assignment_id, action, reason } = await req.json()
  if (!assignment_id || !action) return NextResponse.json({ error: 'assignment_id and action required' }, { status: 400 })

  const now = new Date().toISOString()

  // Get assignment and resolve line/WO via separate query (no PostgREST join)
  const { data: assign } = await s.from('wo_job_assignments').select('line_id').eq('id', assignment_id).single()
  if (!assign) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const lineId = assign.line_id
  let woId: string | null = null
  let lineDesc = ''
  let lineEstimatedHours: number | null = null
  let lineBilledHours: number | null = null
  if (lineId) {
    const { data: line } = await s.from('so_lines').select('so_id, description, estimated_hours, billed_hours').eq('id', lineId).single()
    woId = line?.so_id || null
    lineDesc = line?.description?.slice(0, 50) || ''
    lineEstimatedHours = line?.estimated_hours ?? null
    lineBilledHours = line?.billed_hours ?? null
  }

  if (action === 'accept') {
    await s.from('wo_job_assignments').update({ updated_at: now }).eq('id', assignment_id)
    if (lineId) await s.from('so_lines').update({ line_status: 'in_progress' }).eq('id', lineId)
    if (woId) await s.from('wo_activity_log').insert({ wo_id: woId, user_id: actor.id, action: `Mechanic accepted job: ${lineDesc}` })
  } else if (action === 'decline') {
    await s.from('wo_job_assignments').delete().eq('id', assignment_id)
    if (woId) await s.from('wo_activity_log').insert({ wo_id: woId, user_id: actor.id, action: `Mechanic declined job${reason ? ': ' + reason : ''}` })
  } else if (action === 'complete') {
    await s.from('wo_job_assignments').update({ updated_at: now }).eq('id', assignment_id)
    if (lineId) {
      // Auto-populate billed_hours from estimated_hours (book hours) if not already set
      const lineUpdate: Record<string, any> = { line_status: 'completed' }
      if (lineBilledHours == null && lineEstimatedHours != null && lineEstimatedHours > 0) {
        lineUpdate.billed_hours = lineEstimatedHours
      }
      await s.from('so_lines').update(lineUpdate).eq('id', lineId)
    }
    // Auto clock-out any active timer for this mechanic on this WO
    if (woId) {
      const { data: activeTimers } = await s.from('so_time_entries')
        .select('id, clocked_in_at')
        .eq('user_id', actor.id)
        .eq('so_id', woId)
        .is('clocked_out_at', null)
      for (const timer of activeTimers || []) {
        const durationMin = Math.round((Date.now() - new Date(timer.clocked_in_at).getTime()) / 60000)
        await s.from('so_time_entries').update({ clocked_out_at: now, duration_minutes: durationMin }).eq('id', timer.id)
      }
    }

    if (woId) await s.from('wo_activity_log').insert({ wo_id: woId, user_id: actor.id, action: `Mechanic completed job: ${lineDesc}` })

    // Check if all jobs on this WO are now complete
    if (woId) {
      try {
        const { data: woLines } = await s.from('so_lines')
          .select('line_status')
          .eq('so_id', woId)
          .in('line_type', ['labor', 'job'])

        const allDone = woLines && woLines.length > 0 && woLines.every((l: any) => l.line_status === 'completed')

        if (allDone) {
          await s.from('service_orders').update({ status: 'done' }).eq('id', woId)

          const { data: wo } = await s.from('service_orders')
            .select('shop_id, customer_id, customers(customer_type, is_owner_operator)')
            .eq('id', woId).single()

          const customerType = (wo?.customers as any)?.is_owner_operator ? 'owner_operator' : ((wo?.customers as any)?.customer_type || 'company')

          if (customerType === 'owner_operator' || customerType === 'outside_customer') {
            await sendPaymentNotifications(woId, wo?.shop_id)
          } else {
            await makeCompletionCalls(woId, wo?.shop_id)
          }

          // Notify accounting / service writer that WO is ready for invoice review
          if (wo?.shop_id) {
            const { data: woInfo } = await s.from('service_orders').select('so_number, assets(unit_number)').eq('id', woId).single()
            const soNum = (woInfo as any)?.so_number || ''
            const unitNum = (woInfo as any)?.assets?.unit_number || ''
            const { data: targets } = await s.from('users')
              .select('id')
              .eq('shop_id', wo.shop_id)
              .in('role', ['accountant', 'accounting_manager', 'service_writer', 'office_admin'])
              .or('is_autobot.is.null,is_autobot.eq.false')
            for (const t of targets || []) {
              await s.from('notifications').insert({
                shop_id: wo.shop_id, user_id: t.id, type: 'wo_ready_for_invoice',
                title: `WO Ready for Invoice: ${soNum}`,
                message: `All jobs complete on WO #${soNum}${unitNum ? ` — Unit #${unitNum}` : ''}. Ready for invoice review.`,
                link: `/work-orders/${woId}`,
              })
            }
          }
        }
      } catch (err) {
        console.error('[Job Complete] Notification trigger failed:', err)
      }
    }
  } else if (action === 'start') {
    await s.from('wo_job_assignments').update({ updated_at: now }).eq('id', assignment_id)
    if (lineId) await s.from('so_lines').update({ line_status: 'in_progress' }).eq('id', lineId)
    if (woId) await s.from('wo_activity_log').insert({ wo_id: woId, user_id: actor.id, action: 'Mechanic started work on job' })
  }

  return NextResponse.json({ ok: true })
}
