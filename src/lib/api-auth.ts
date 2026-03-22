/**
 * TruckZen — Original Design
 * Public API authentication — API key validation + rate limiting
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex')
}

export interface ApiAuth {
  shopId: string
  permissions: string[]
  keyId: string
}

export async function validateApiKey(req: Request): Promise<ApiAuth | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer tz_')) return null

  const key = auth.replace('Bearer ', '')
  const hash = sha256(key)
  const s = db()

  const { data } = await s.from('api_keys')
    .select('id, shop_id, permissions, rate_limit, active, expires_at, request_count')
    .eq('key_hash', hash).eq('active', true).single()

  if (!data) return null
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null

  // Update usage
  await s.from('api_keys').update({
    last_used_at: new Date().toISOString(),
    request_count: (data.request_count || 0) + 1,
  }).eq('id', data.id)

  return { shopId: data.shop_id, permissions: data.permissions || ['read'], keyId: data.id }
}

export function apiError(code: string, message: string, status: number = 400) {
  return Response.json({ success: false, error: { code, message } }, { status })
}

export function apiSuccess(data: any, pagination?: { total: number; page: number; limit: number; totalPages: number }) {
  return Response.json({
    success: true,
    data,
    ...(pagination ? { pagination } : {}),
    generated_at: new Date().toISOString(),
  })
}

// Generate a new API key
export function generateApiKey(shopPrefix: string): { key: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(16).toString('hex')
  const prefix = shopPrefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 6)
  const key = `tz_live_${prefix}_${random}`
  const hash = sha256(key)
  return { key, hash, prefix: `tz_live_${prefix}_${random.slice(0, 4)}...` }
}
