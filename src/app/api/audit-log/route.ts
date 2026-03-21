import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const shop_id = url.searchParams.get('shop_id')
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const action = url.searchParams.get('action')
  const entity_type = url.searchParams.get('entity_type')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const user_id = url.searchParams.get('user_id')
  const limit = parseInt(url.searchParams.get('limit') || '100', 10)

  const s = db()
  let q = s.from('audit_log').select('*, users(full_name, email)').eq('shop_id', shop_id).order('created_at', { ascending: false }).limit(limit)

  if (action) q = q.eq('action', action)
  if (entity_type) q = q.eq('entity_type', entity_type)
  if (from) q = q.gte('created_at', from)
  if (to) q = q.lte('created_at', to)
  if (user_id) q = q.eq('user_id', user_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}
