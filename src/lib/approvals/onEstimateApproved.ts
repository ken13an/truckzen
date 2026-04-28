import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { repairTrackingLinkEmail } from '@/lib/emails/repairTrackingLink'

export type OnEstimateApprovedSource = 'portal_estimate_approve' | 'portal_approve'

export interface OnEstimateApprovedInput {
  supabase: SupabaseClient
  serviceOrderId: string
  source: OnEstimateApprovedSource
}

export interface OnEstimateApprovedResult {
  sent: boolean
  skipped?: string
  error?: string
}

const TRACKING_EVENT = 'tracking.repair_link.sent'

export async function onEstimateApproved(input: OnEstimateApprovedInput): Promise<OnEstimateApprovedResult> {
  const { supabase: s, serviceOrderId, source } = input

  try {
    const { data: wo, error: woErr } = await s
      .from('service_orders')
      .select('id, so_number, portal_token, ownership_type, customer_id, shop_id')
      .eq('id', serviceOrderId)
      .single()

    if (woErr || !wo) return { sent: false, skipped: 'wo_not_found' }
    if (!wo.shop_id) return { sent: false, skipped: 'shop_id_missing' }
    if (!wo.portal_token) return { sent: false, skipped: 'portal_token_missing' }

    if (wo.ownership_type !== 'owner_operator' && wo.ownership_type !== 'outside_customer') {
      return { sent: false, skipped: `ownership_not_eligible:${wo.ownership_type ?? 'unknown'}` }
    }

    if (!wo.customer_id) return { sent: false, skipped: 'customer_missing' }

    const { data: customer, error: custErr } = await s
      .from('customers')
      .select('email, company_name, contact_name')
      .eq('id', wo.customer_id)
      .single()

    if (custErr || !customer) return { sent: false, skipped: 'customer_not_found' }
    if (!customer.email) return { sent: false, skipped: 'customer_email_missing' }

    const { data: existing, error: existingErr } = await s
      .from('notification_log')
      .select('id')
      .eq('shop_id', wo.shop_id)
      .eq('event', TRACKING_EVENT)
      .like('message', `%wo=${wo.id}%`)
      .limit(1)

    if (existingErr) {
      console.error('[onEstimateApproved] idempotency check failed', { woId: wo.id, error: existingErr.message })
      return { sent: false, error: 'idempotency_check_failed' }
    }
    if (existing && existing.length > 0) {
      return { sent: false, skipped: 'already_sent' }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
    const trackingLink = `${baseUrl}/portal/${wo.portal_token}`

    const shop = await getShopInfo(wo.shop_id)
    const customerName = customer.contact_name || customer.company_name || 'there'

    const { subject, html } = repairTrackingLinkEmail({
      customerName,
      woNumber: wo.so_number || wo.id,
      trackingLink,
      shop: { name: shop.name, phone: shop.phone, logoUrl: shop.logoUrl },
    })

    const ok = await sendEmail(customer.email, subject, html)

    const recipientForLog = customer.email
    const message = `wo=${wo.id} so=${wo.so_number ?? ''} recipient=${recipientForLog} source=${source} ok=${ok}`
    const { error: logErr } = await s.from('notification_log').insert({
      shop_id: wo.shop_id,
      event: TRACKING_EVENT,
      recipients: [],
      channels: ['email'],
      message,
    })
    if (logErr) {
      console.error('[onEstimateApproved] notification_log insert failed', { woId: wo.id, error: logErr.message })
    }

    if (!ok) return { sent: false, error: 'send_failed' }
    return { sent: true }
  } catch (err: any) {
    console.error('[onEstimateApproved] unexpected error', { serviceOrderId, error: err?.message })
    return { sent: false, error: 'unexpected_error' }
  }
}
