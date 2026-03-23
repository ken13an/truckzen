// Server-side notification helpers (for use in API routes)
// These call the push notification API endpoint internally

import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  try {
    const s = db()
    const { data: user } = await s.from('users').select('push_token').eq('id', userId).single()
    if (!user?.push_token) return

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ to: user.push_token, title, body, data: data || {}, sound: 'default' }]),
    })
  } catch (err) {
    console.error('[Push] sendPushToUser failed:', err)
  }
}

export async function sendPushToRole(shopId: string, role: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  try {
    const s = db()
    const { data: users } = await s.from('users')
      .select('push_token')
      .eq('shop_id', shopId)
      .eq('role', role)
      .is('deleted_at', null)
      .not('push_token', 'is', null)

    const tokens = (users || []).map((u: any) => u.push_token).filter(Boolean)
    if (tokens.length === 0) return

    const messages = tokens.map((token: string) => ({ to: token, title, body, data: data || {}, sound: 'default' as const }))
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    })
  } catch (err) {
    console.error('[Push] sendPushToRole failed:', err)
  }
}

export async function sendPushToShopAdmins(shopId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  try {
    const s = db()
    const { data: users } = await s.from('users')
      .select('push_token')
      .eq('shop_id', shopId)
      .in('role', ['owner', 'gm', 'it_person', 'shop_manager'])
      .is('deleted_at', null)
      .not('push_token', 'is', null)

    const tokens = (users || []).map((u: any) => u.push_token).filter(Boolean)
    if (tokens.length === 0) return

    const messages = tokens.map((token: string) => ({ to: token, title, body, data: data || {}, sound: 'default' as const }))
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    })
  } catch (err) {
    console.error('[Push] sendPushToShopAdmins failed:', err)
  }
}
