import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'

export async function GET(req: Request) {
  const { error } = await requirePlatformOwner()
  if (error) return error

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const actionType = searchParams.get('action_type')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'))

  let query = s.from('platform_activity_log').select('*').order('created_at', { ascending: false }).limit(limit)
  if (shopId) query = query.eq('shop_id', shopId)
  if (actionType && actionType !== 'all') query = query.eq('action_type', actionType)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59Z`)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const enriched = await Promise.all((data || []).map(async (a: any) => {
    const [{ data: sh }, { data: u }] = await Promise.all([
      a.shop_id ? s.from('shops').select('name').eq('id', a.shop_id).single() : Promise.resolve({ data: null }),
      a.performed_by ? s.from('users').select('full_name').eq('id', a.performed_by).single() : Promise.resolve({ data: null }),
    ])
    return { ...a, shop_name: sh?.name || null, performed_by_name: u?.full_name || null }
  }))

  return NextResponse.json(enriched)
}
