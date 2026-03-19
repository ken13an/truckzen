// lib/notifications/index.ts
// Unified notification dispatcher
// One function that routes to SMS (Twilio), Telegram, and mobile Push
// Based on what each user has connected

import { createClient } from '@supabase/supabase-js'
import { sendSMS, SMS } from '@/lib/integrations/twilio'

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
function getTgBase() {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
}

// ── TYPES ─────────────────────────────────────────────────────
export type NotifyEvent =
  | 'parts_ready'
  | 'job_done'
  | 'kiosk_checkin'
  | 'invoice_sent'
  | 'invoice_overdue'
  | 'pm_due'
  | 'compliance_expiring'
  | 'new_job_assigned'
  | 'status_changed'
  | 'cleaning_assignment'

export interface NotifyPayload {
  event:        NotifyEvent
  shop_id:      string
  user_id?:     string      // specific user to notify
  role?:        string      // notify first user with this role
  so_number?:   string
  truck_unit?:  string
  customer_name?:string
  part_name?:   string
  bin_location?:string
  invoice_number?:string
  amount?:      number
  payment_url?: string
  message?:     string      // custom override message
  data?:        Record<string, any>
}

// ── MAIN DISPATCHER ───────────────────────────────────────────
export async function notify(payload: NotifyPayload): Promise<{ sent: number; channels: string[] }> {
  const channels: string[] = []
  let sent = 0

  // Resolve target user(s)
  const users = await resolveTargets(payload)
  if (!users.length) return { sent: 0, channels: [] }

  const message = buildMessage(payload)

  for (const user of users) {
    // 1. Telegram (if linked)
    if (user.telegram_id) {
      const ok = await sendTelegram(user.telegram_id, message)
      if (ok) { channels.push('telegram'); sent++ }
    }

    // 2. SMS (if phone on file)
    if (user.phone) {
      const ok = await sendSMS(user.phone, message)
      if (ok) { channels.push('sms'); sent++ }
    }

    // 3. Push notification (if push token on file)
    if (user.push_token) {
      const ok = await sendPush(user.push_token, payload.event, message, payload.data)
      if (ok) { channels.push('push'); sent++ }
    }
  }

  // Log notification
  if (sent > 0) {
    await getSupabase().from('notification_log').insert({
      shop_id:      payload.shop_id,
      event:        payload.event,
      recipients:   users.map(u => u.id),
      channels,
      message,
      sent_at:      new Date().toISOString(),
    })
  }

  return { sent, channels: [...new Set(channels)] }
}

// ── TARGET RESOLVER ───────────────────────────────────────────
async function resolveTargets(payload: NotifyPayload) {
  if (payload.user_id) {
    const { data } = await getSupabase().from('users')
      .select('id, telegram_id, push_token, phone')
      .eq('id', payload.user_id)
      .eq('active', true)
      .single()
    return data ? [data] : []
  }

  if (payload.role) {
    const { data } = await getSupabase().from('users')
      .select('id, telegram_id, push_token, phone')
      .eq('shop_id', payload.shop_id)
      .eq('role', payload.role)
      .eq('active', true)
      .limit(3)
    return data || []
  }

  return []
}

// ── MESSAGE BUILDER ───────────────────────────────────────────
function buildMessage(p: NotifyPayload): string {
  if (p.message) return p.message

  const shop = 'TruckZen'
  switch (p.event) {
    case 'parts_ready':
      return SMS.partsReady('Tech', p.so_number || '', p.truck_unit || '', p.bin_location)
    case 'job_done':
      return SMS.jobDone(p.customer_name || '', p.truck_unit || '', shop, p.payment_url)
    case 'kiosk_checkin':
      return `🚛 New kiosk check-in — Truck #${p.truck_unit}. ${p.customer_name || 'Customer'} is waiting.`
    case 'invoice_sent':
      return `📄 Invoice ${p.invoice_number} sent — $${p.amount?.toFixed(0)}. ${p.payment_url ? 'Pay: ' + p.payment_url : ''}`
    case 'invoice_overdue':
      return SMS.invoiceReminder(p.customer_name || '', p.invoice_number || '', p.amount || 0, p.payment_url || '')
    case 'pm_due':
      return `🔧 PM Due: Truck #${p.truck_unit} needs ${p.message || 'scheduled service'}. Call to schedule.`
    case 'compliance_expiring':
      return `⚠️ Compliance expiring: ${p.message || 'document expiring soon'}. Update in TruckZen.`
    case 'new_job_assigned':
      return `🔧 New job assigned: ${p.so_number} — Truck #${p.truck_unit}. Check your TruckZen app.`
    case 'status_changed':
      return `📋 ${p.so_number} status updated: ${p.message || 'check TruckZen for details'}`
    case 'cleaning_assignment':
      return SMS.cleaningAssignment('Tech', p.message || 'shop area', shop)
    default:
      return p.message || `TruckZen notification — check your app.`
  }
}

// ── CHANNEL SENDERS ───────────────────────────────────────────
async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${getTgBase()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
    return res.ok
  } catch { return false }
}

async function sendPush(token: string, event: string, body: string, data?: Record<string, any>): Promise<boolean> {
  // Expo push notifications — works for both iOS and Android
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        to:    token,
        title: 'TruckZen',
        body,
        data:  { event, ...data },
        sound: 'default',
        badge: 1,
      }),
    })
    return res.ok
  } catch { return false }
}

// ── CONVENIENCE FUNCTIONS ─────────────────────────────────────
export async function notifyPartsReady(shopId: string, techId: string, soNumber: string, truckUnit: string, binLocation?: string) {
  return notify({ event:'parts_ready', shop_id:shopId, user_id:techId, so_number:soNumber, truck_unit:truckUnit, bin_location:binLocation })
}

export async function notifyJobDone(shopId: string, customerId: string, truckUnit: string, paymentUrl?: string) {
  return notify({ event:'job_done', shop_id:shopId, role:'service_writer', truck_unit:truckUnit, payment_url:paymentUrl })
}

export async function notifyKioskCheckin(shopId: string, truckUnit: string, customerName?: string) {
  return notify({ event:'kiosk_checkin', shop_id:shopId, role:'service_writer', truck_unit:truckUnit, customer_name:customerName })
}

export async function notifyNewJobAssigned(shopId: string, techId: string, soNumber: string, truckUnit: string) {
  return notify({ event:'new_job_assigned', shop_id:shopId, user_id:techId, so_number:soNumber, truck_unit:truckUnit })
}
