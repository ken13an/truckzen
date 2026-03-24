import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

interface CreateNotificationParams {
  shopId: string
  recipientId: string | string[]
  type: string
  title: string
  body: string
  link?: string
  relatedWoId?: string
  relatedUnit?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

/**
 * Create in-app notification(s). Never throws — catches silently.
 * If recipientId is an array, creates one notification per recipient.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const s = db()
    const recipients = Array.isArray(params.recipientId) ? params.recipientId : [params.recipientId]

    const rows = recipients.map(uid => ({
      shop_id: params.shopId,
      user_id: uid,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link || null,
      related_wo_id: params.relatedWoId || null,
      related_unit: params.relatedUnit || null,
      priority: params.priority || 'normal',
      read: false,
      is_read: false,
      is_dismissed: false,
    }))

    if (rows.length > 0) {
      await s.from('notifications').insert(rows)
    }
  } catch (err) {
    console.error('[createNotification] Error:', err)
    // Never throw — notifications should never break main flow
  }
}

/**
 * Helper: get all user IDs with a specific role at a shop
 */
export async function getUserIdsByRole(shopId: string, roles: string[]): Promise<string[]> {
  try {
    const s = db()
    const { data } = await s.from('users').select('id').eq('shop_id', shopId).in('role', roles)
    return (data || []).map((u: any) => u.id)
  } catch {
    return []
  }
}
