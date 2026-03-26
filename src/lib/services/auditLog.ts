import { createAdminSupabaseClient } from '@/lib/server-auth'

export async function logAction(params: {
  shop_id: string
  user_id?: string | null
  action: string
  entity_type: string
  entity_id: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const s = createAdminSupabaseClient()
    await s.from('audit_log').insert({
      shop_id: params.shop_id,
      user_id: params.user_id || null,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      details: params.details || null,
      created_at: new Date().toISOString(),
    })
  } catch {
    // never fail the primary request because audit logging failed
  }
}
