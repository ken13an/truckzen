import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function logAction(params: {
  shop_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const s = db()
    await s.from('audit_log').insert({
      shop_id: params.shop_id,
      user_id: params.user_id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      details: params.details || null,
      created_at: new Date().toISOString(),
    }).then(() => {})
  } catch {}
}
