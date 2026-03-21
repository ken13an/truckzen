import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPaymentNotifications } from '@/lib/notifications/sendPaymentNotifications'
import { makeCompletionCalls } from '@/lib/notifications/makeCompletionCalls'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const s = db()
  const { assignment_id, action, user_id, reason } = await req.json()
  if (!assignment_id || !action) return NextResponse.json({ error: 'assignment_id and action required' }, { status: 400 })

  const now = new Date().toISOString()

  // Get assignment + WO info for activity logging
  const { data: assign } = await s.from('job_assignments').select('so_line_id, so_lines(so_id, description)').eq('id', assignment_id).single()
  const woId = (assign?.so_lines as any)?.so_id

  if (action === 'accept') {
    await s.from('job_assignments').update({ status: 'accepted', accepted_at: now, updated_at: now }).eq('id', assignment_id)
    if (assign?.so_line_id) await s.from('so_lines').update({ line_status: 'in_progress' }).eq('id', assign.so_line_id)
    if (woId && user_id) await s.from('wo_activity_log').insert({ wo_id: woId, user_id, action: `Mechanic accepted job: ${(assign?.so_lines as any)?.description?.slice(0, 50) || ''}` })
  } else if (action === 'decline') {
    await s.from('job_assignments').update({ status: 'declined', declined_at: now, decline_reason: reason || null, updated_at: now }).eq('id', assignment_id)
    if (woId && user_id) await s.from('wo_activity_log').insert({ wo_id: woId, user_id, action: `Mechanic declined job${reason ? ': ' + reason : ''}` })
  } else if (action === 'complete') {
    await s.from('job_assignments').update({ status: 'completed', completed_at: now, updated_at: now }).eq('id', assignment_id)
    if (assign?.so_line_id) await s.from('so_lines').update({ line_status: 'completed' }).eq('id', assign.so_line_id)
    if (woId && user_id) await s.from('wo_activity_log').insert({ wo_id: woId, user_id, action: `Mechanic completed job: ${(assign?.so_lines as any)?.description?.slice(0, 50) || ''}` })

    // Check if all jobs on this WO are now complete
    const serviceOrderId = woId
    if (serviceOrderId) {
      ;(async () => {
        try {
          const { data: woLines } = await s.from('so_lines')
            .select('line_status')
            .eq('service_order_id', serviceOrderId)
            .in('line_type', ['labor', 'job'])

          const allDone = woLines && woLines.length > 0 && woLines.every((l: any) => l.line_status === 'completed')

          if (allDone) {
            // Update WO status
            await s.from('service_orders').update({ status: 'done' }).eq('id', serviceOrderId)

            // Get customer type
            const { data: wo } = await s.from('service_orders')
              .select('shop_id, customer_id, customers(customer_type, is_owner_operator)')
              .eq('id', serviceOrderId).single()

            const customerType = (wo?.customers as any)?.is_owner_operator ? 'owner_operator' : ((wo?.customers as any)?.customer_type || 'company')

            if (customerType === 'owner_operator' || customerType === 'outside_customer') {
              await sendPaymentNotifications(serviceOrderId, wo?.shop_id)
            } else {
              await makeCompletionCalls(serviceOrderId, wo?.shop_id)
            }
          }
        } catch (err) {
          console.error('[Job Complete] Notification trigger failed:', err)
        }
      })()
    }
  } else if (action === 'start') {
    await s.from('job_assignments').update({ status: 'in_progress', updated_at: now }).eq('id', assignment_id)
    if (assign?.so_line_id) await s.from('so_lines').update({ line_status: 'in_progress' }).eq('id', assign.so_line_id)
    if (woId && user_id) await s.from('wo_activity_log').insert({ wo_id: woId, user_id, action: 'Mechanic started work on job' })
  }

  return NextResponse.json({ ok: true })
}
