/**
 * TruckZen — API key management
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateApiKey } from '@/lib/api-auth'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const userId = searchParams.get('user_id')
  if (!shopId || !userId) return NextResponse.json({ error: 'shop_id and user_id required' }, { status: 400 })

  const { data } = await s.from('api_keys').select('id, key_prefix, name, permissions, rate_limit, last_used_at, request_count, active, expires_at, created_at')
    .eq('shop_id', shopId).order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const s = db()
  const { shop_id, user_id, name } = await req.json()
  if (!shop_id || !user_id || !name) return NextResponse.json({ error: 'shop_id, user_id, name required' }, { status: 400 })

  // Get shop prefix
  const { data: shop } = await s.from('shops').select('name').eq('id', shop_id).single()
  const shopPrefix = (shop?.name || 'shop').replace(/[^a-zA-Z]/g, '').slice(0, 6)

  const { key, hash, prefix } = generateApiKey(shopPrefix)

  await s.from('api_keys').insert({ shop_id, key_hash: hash, key_prefix: prefix, name, created_by: user_id })

  // Return the full key ONCE — never stored or shown again
  return NextResponse.json({ key, prefix, name })
}

export async function DELETE(req: Request) {
  const s = db()
  const { id, shop_id } = await req.json()
  if (!id || !shop_id) return NextResponse.json({ error: 'id and shop_id required' }, { status: 400 })

  await s.from('api_keys').update({ active: false }).eq('id', id).eq('shop_id', shop_id)
  return NextResponse.json({ ok: true })
}
