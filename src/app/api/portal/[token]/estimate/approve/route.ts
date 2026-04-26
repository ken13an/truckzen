import { NextResponse } from 'next/server'
import { checkPortalLimits } from '@/lib/ratelimit/portal-guard'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { staffEstimateApprovedEmail } from '@/lib/emails/staffEstimateApproved'
import { sendPushToUser } from '@/lib/services/notifications'
import { assertPartsRequirementResolved } from '@/lib/parts-status'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

export async function POST(req: Request, { params }: P) {
  const { token } = await params
  const _rl = await checkPortalLimits(req, token); if (_rl !== true) return _rl
  const s = db()

  const { data: wo } = await s.from('service_orders').select('id, so_number, shop_id, customer_id, created_by_user_id, grand_total, status').eq('portal_token', token).single()
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Parts-readiness gate — every non-canceled labor line must have a resolved
  // parts_requirement before flipping any line/WO approval flags. Portal uses
  // a non-override actor role so 'override'-labeled lines fail-safe to blocked.
  const partsGate = await assertPartsRequirementResolved(s, wo.id, 'customer_portal')
  if (!partsGate.ok) {
    console.warn('[portal-estimate-approve] parts gate blocked', { woId: wo.id, failures: partsGate.failures })
    return NextResponse.json({
      error: 'Resolve parts decisions before approving this estimate.',
      unresolved_lines: partsGate.failures,
    }, { status: 422 })
  }

  const now = new Date().toISOString()
  const woUpdate: Record<string, any> = {
    estimate_status: 'approved',
    estimate_approved: true,
    estimate_approved_date: now,
    approved_at: now,
    approved_by: 'customer_portal',
  }

  // Auto-transition: if WO is waiting for approval, move to in_progress
  if (wo.status === 'waiting_approval') {
    woUpdate.status = 'in_progress'
  }

  await s.from('service_orders').update(woUpdate).eq('id', wo.id)

  // Approve all pending lines
  await s.from('so_lines').update({ customer_approved: true, approved_at: now }).eq('so_id', wo.id).is('customer_approved', null)

  // Log activity
  await s.from('wo_activity_log').insert({ wo_id: wo.id, action: 'Customer approved estimate via portal' })

  // Fire-and-forget: notify the WO creator
  ;(async () => {
    try {
      const shop = await getShopInfo(wo.shop_id)
      const { data: customer } = await s.from('customers').select('company_name').eq('id', wo.customer_id).single()
      const customerName = customer?.company_name || 'Customer'

      // Email to created_by user
      if (wo.created_by_user_id) {
        const { data: creator } = await s.from('users').select('email').eq('id', wo.created_by_user_id).single()
        if (creator?.email) {
          const { subject, html } = staffEstimateApprovedEmail({
            customerName,
            woNumber: wo.so_number,
            amount: String(wo.grand_total || '0'),
            shop,
          })
          await sendEmail(creator.email, subject, html)
        }

        // Push notification
        await sendPushToUser(wo.created_by_user_id, 'Estimate Approved', `${customerName} approved ${wo.so_number}`)
      }
    } catch {}
  })()

  // In-app notifications
  try {
    const { createNotification, getUserIdsByRole } = await import('@/lib/createNotification')
    // Notify service writer + floor managers
    const swIds = await getUserIdsByRole(wo.shop_id, ['service_writer', 'service_advisor'])
    const fmIds = await getUserIdsByRole(wo.shop_id, ['shop_manager', 'floor_manager'])
    await createNotification({
      shopId: wo.shop_id, recipientId: [...swIds, ...fmIds], type: 'customer_approved',
      title: 'Estimate Approved', body: `Customer approved estimate for ${wo.so_number} — work can now be assigned`,
      link: `/work-orders/${wo.id}`, relatedWoId: wo.id, priority: 'high',
    })
  } catch {}

  return NextResponse.json({ ok: true })
}
