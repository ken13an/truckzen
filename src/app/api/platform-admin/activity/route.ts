import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/platform-admin/activity — platform activity log
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const shopId = searchParams.get('shop_id')
  const actionType = searchParams.get('action_type')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = parseInt(searchParams.get('limit') || '50')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', userId).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  let query = s.from('platform_activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (shopId) query = query.eq('shop_id', shopId)
  if (actionType && actionType !== 'all') query = query.eq('action_type', actionType)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59Z')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with shop name and performer name
  const enriched = await Promise.all((data || []).map(async (a: any) => {
    let shopName = null
    if (a.shop_id) {
      const { data: sh } = await s.from('shops').select('name').eq('id', a.shop_id).single()
      shopName = sh?.name || null
    }
    let performedByName = null
    if (a.performed_by) {
      const { data: u } = await s.from('users').select('full_name').eq('id', a.performed_by).single()
      performedByName = u?.full_name || null
    }
    return { ...a, shop_name: shopName, performed_by_name: performedByName }
  }))

  return NextResponse.json(enriched)
}
