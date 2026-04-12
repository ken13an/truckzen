import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { safeRoute } from '@/lib/api-handler'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

async function _GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const mechanicId = searchParams.get('mechanic_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = db()
    .from('mechanic_weekly_reports')
    .select('*, users:mechanic_id(id, full_name, email)')
    .order('week_start', { ascending: false })

  if (shopId) query = query.eq('shop_id', shopId)
  if (mechanicId) query = query.eq('mechanic_id', mechanicId)
  if (from) query = query.gte('week_start', from)
  if (to) query = query.lte('week_end', to)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export const GET = safeRoute(_GET)
