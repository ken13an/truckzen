import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function makeCompletionCalls(woId: string, shopId: string) {
  const s = db()

  // Get WO + asset + shop info
  const { data: wo } = await s.from('service_orders')
    .select('id, so_number, asset_id, assets(unit_number, year, make, model, contact_phone)')
    .eq('id', woId).single()
  if (!wo) return

  const { data: shop } = await s.from('shops')
    .select('name, maintenance_coordinator_phone')
    .eq('id', shopId).single()

  const asset = wo.assets as any
  const unitNumber = asset?.unit_number || 'unknown'
  const truckDesc = [asset?.year, asset?.make, asset?.model].filter(Boolean).join(' ') || 'truck'

  // Get driver phone from kiosk checkin or asset
  const { data: checkin } = await s.from('kiosk_checkins')
    .select('contact_phone').eq('wo_id', woId).order('created_at', { ascending: false }).limit(1).single()
  const driverPhone = checkin?.contact_phone || asset?.contact_phone
  const coordPhone = shop?.maintenance_coordinator_phone

  const promises: Promise<void>[] = []

  // Call 1 — Maintenance Coordinator
  if (coordPhone) {
    promises.push((async () => {
      try {
        const twilio = (await import('twilio')).default
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
        const twiml = `<Response><Say voice="Polly.Joanna">Hello. This is an automated message from ${shop?.name || 'UGL Truck Center'}. Truck unit ${unitNumber}, a ${truckDesc}, has been serviced and is ready for pickup. Work Order number ${wo.so_number} is now complete. Please coordinate with the driver for truck retrieval. Thank you.</Say></Response>`
        await client.calls.create({ twiml, to: coordPhone, from: process.env.TWILIO_PHONE_NUMBER! })
        await logNotification(s, shopId, woId, 'call_coordinator', coordPhone, null, 'sent')
      } catch (err: any) {
        console.error('[Call Coordinator] Failed:', err.message)
        await logNotification(s, shopId, woId, 'call_coordinator', coordPhone, null, 'failed', err.message)
      }
    })())
  } else {
    console.warn(`[Notification] No coordinator phone for shop ${shopId}`)
  }

  // Call 2 — Driver
  if (driverPhone) {
    promises.push((async () => {
      try {
        const twilio = (await import('twilio')).default
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
        const twiml = `<Response><Say voice="Polly.Joanna">Hello. This is an automated message from ${shop?.name || 'UGL Truck Center'}. Your truck, unit number ${unitNumber}, is ready for pickup. Please contact your maintenance coordinator to schedule retrieval. Thank you, and have a safe drive.</Say></Response>`
        await client.calls.create({ twiml, to: driverPhone, from: process.env.TWILIO_PHONE_NUMBER! })
        await logNotification(s, shopId, woId, 'call_driver', driverPhone, null, 'sent')
      } catch (err: any) {
        console.error('[Call Driver] Failed:', err.message)
        await logNotification(s, shopId, woId, 'call_driver', driverPhone, null, 'failed', err.message)
      }
    })())
  } else {
    console.warn(`[Notification] No driver phone for WO ${wo.so_number}`)
  }

  await Promise.all(promises)
}

async function logNotification(s: any, shopId: string, woId: string, type: string, phone: string | null, email: string | null, status: string, error?: string) {
  // Canonical notification_log schema (see supabase/000_full_setup.sql and
  // lib/notifications/index.ts). Kept in sync with the copy in
  // sendPaymentNotifications.ts — previous writes to wo_id/recipient_phone/
  // etc. columns did not exist on the table and failed silently.
  const recipient = email || phone || 'unknown'
  const event = `wo.${type}.${status}`
  const message = `wo=${woId} recipient=${recipient}${error ? ` error=${error}` : ''}`
  const { error: insertErr } = await s.from('notification_log').insert({
    shop_id: shopId,
    event,
    recipients: [],
    channels: [type],
    message,
  })
  if (insertErr) {
    console.error('[notification_log] insert failed', { event, error: insertErr.message })
  }
}
