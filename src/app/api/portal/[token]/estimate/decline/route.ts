import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { staffEstimateDeclinedEmail } from '@/lib/emails/staffEstimateDeclined'
import { sendPushToUser } from '@/lib/services/notifications'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

export async function POST(req: Request, { params }: P) {
  const { token } = await params
  const s = db()
  const body = await req.json().catch(() => ({}))

  const { data: wo } = await s.from('service_orders').select('id, so_number, shop_id, customer_id, created_by_user_id').eq('portal_token', token).single()
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await s.from('service_orders').update({
    estimate_status: 'declined',
    estimate_declined_reason: body.reason || null,
  }).eq('id', wo.id)

  await s.from('wo_activity_log').insert({
    wo_id: wo.id,
    action: `Customer declined estimate${body.reason ? ': ' + body.reason : ''} via portal`,
  })

  // Fire-and-forget: notify the WO creator
  ;(async () => {
    try {
      if (!wo.created_by_user_id) return
      const shop = await getShopInfo(wo.shop_id)
      const { data: customer } = await s.from('customers').select('company_name').eq('id', wo.customer_id).single()
      const customerName = customer?.company_name || 'Customer'
      const reason = body.reason || 'No reason provided'

      const { data: creator } = await s.from('users').select('email').eq('id', wo.created_by_user_id).single()
      if (creator?.email) {
        const { subject, html } = staffEstimateDeclinedEmail({
          customerName,
          woNumber: wo.so_number,
          reason,
          shop,
        })
        await sendEmail(creator.email, subject, html)
      }

      // Push notification
      await sendPushToUser(wo.created_by_user_id, 'Estimate Declined', `${customerName} declined ${wo.so_number}${body.reason ? ': ' + body.reason : ''}`)
    } catch {}
  })()

  // In-app notification
  try {
    const { createNotification, getUserIdsByRole } = await import('@/lib/createNotification')
    const writers = await getUserIdsByRole(wo.shop_id, ['service_writer', 'service_advisor'])
    await createNotification({
      shopId: wo.shop_id, recipientId: writers, type: 'estimate_declined',
      title: 'Estimate Declined', body: `Customer declined estimate for ${wo.so_number}${body.reason ? ' — ' + body.reason : ''} — follow up required`,
      link: `/work-orders/${wo.id}`, relatedWoId: wo.id, priority: 'urgent',
    })
  } catch {}

  return NextResponse.json({ ok: true })
}
