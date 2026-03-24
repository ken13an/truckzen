import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAction } from '@/lib/services/auditLog'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const shop_id = url.searchParams.get('shop_id')
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const s = db()
  const { data, error } = await s.from('shops').select('*').eq('id', shop_id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { shop_id, retention_policy } = body
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const s = db()
  const updates: Record<string, any> = {}
  if (retention_policy !== undefined) updates.retention_policy = retention_policy

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await s.from('shops').update(updates).eq('id', shop_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire and forget
  logAction({ shop_id, user_id: '', action: 'settings.updated', entity_type: 'shop', entity_id: shop_id }).catch(() => {})

  return NextResponse.json({ ok: true })
}
