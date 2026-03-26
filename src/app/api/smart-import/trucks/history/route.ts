import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

export async function GET() {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { data, error } = await s.from('import_history')
    .select('*, users!imported_by(full_name)')
    .eq('shop_id', shopId)
    .eq('import_type', 'trucks')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (data || []).map((h: any) => ({
    ...h,
    imported_by_name: h.users?.full_name || '—',
    undo_available: h.status !== 'undone' && h.undo_available_until && new Date(h.undo_available_until) > new Date(),
  }))

  return NextResponse.json(enriched)
}
