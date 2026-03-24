import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data, error } = await s.from('shop_labor_rates').select('*').eq('shop_id', shopId).order('ownership_type')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function PATCH(req: Request) {
  const s = db()
  const { rates, user_id } = await req.json()
  if (!rates || !Array.isArray(rates)) return NextResponse.json({ error: 'rates array required' }, { status: 400 })

  for (const r of rates) {
    if (!r.id || r.rate_per_hour == null) continue
    await s.from('shop_labor_rates').update({
      rate_per_hour: r.rate_per_hour,
      updated_by: user_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', r.id)
  }

  return NextResponse.json({ ok: true })
}
