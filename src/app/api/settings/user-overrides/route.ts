import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser, requireRole } from '@/lib/route-guards'

const OVERRIDE_ROLES = ['owner', 'gm', 'it_person', 'office_admin'] as const

export async function GET(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, OVERRIDE_ROLES)
  if (roleError) return roleError

  const userId = new URL(req.url).searchParams.get('user_id')
  if (!userId) return NextResponse.json([])

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { data: target } = await s.from('users').select('id').eq('id', userId).eq('shop_id', shopId).single()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data, error: dbError } = await s.from('user_permission_overrides').select('module, allowed').eq('user_id', userId)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data || [])
}
