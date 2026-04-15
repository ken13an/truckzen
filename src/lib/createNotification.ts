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
export async function createNotification(params: CreateNotificationParams): Promise<{ inserted: number; rejected: string[] }> {
  const recipients = Array.isArray(params.recipientId) ? params.recipientId : [params.recipientId]
  try {
    const s = db()

    // F-13: verify each recipient belongs to params.shopId before writing a row.
    const { data: validUsers } = await s.from('users')
      .select('id').eq('shop_id', params.shopId).in('id', recipients)
    const validIds = new Set((validUsers || []).map((u: any) => u.id as string))
    const rejected = recipients.filter(id => !validIds.has(id))
    if (rejected.length > 0) {
      console.warn('[createNotification] Dropped cross-shop recipients:', { shopId: params.shopId, rejected })
    }

    const rows = recipients.filter(id => validIds.has(id)).map(uid => ({
      shop_id: params.shopId,
      user_id: uid,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link || null,
      related_wo_id: params.relatedWoId || null,
      related_unit: params.relatedUnit || null,
      priority: params.priority || 'normal',
      is_read: false,
      is_dismissed: false,
    }))

    if (rows.length > 0) {
      await s.from('notifications').insert(rows)
    }
    return { inserted: rows.length, rejected }
  } catch (err) {
    console.error('[createNotification] Error:', err)
    // Never throw — notifications should never break main flow
    return { inserted: 0, rejected: recipients }
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
