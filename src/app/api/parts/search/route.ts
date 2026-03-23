/**
 * TruckZen — Original Design
 * Parts inventory search — for auto-fill in WO parts editing
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const q = searchParams.get('q')

  if (!shopId || !q || q.length < 2) return NextResponse.json([])

  const s = db()
  const { data } = await s.from('parts')
    .select('id, description, part_number, cost_price, sell_price, on_hand')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .or(`part_number.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(5)

  return NextResponse.json(data || [])
}
