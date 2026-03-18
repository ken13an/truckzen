import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { log } from '@/lib/security'

type P = { params: { id: string } }

export async function PATCH(req: Request, { params }: P) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mgmtRoles = ['owner','gm','it_person','shop_manager','office_admin']
  if (!mgmtRoles.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  // Prevent non-owners from modifying owner accounts
  const { data: target } = await supabase.from('users').select('role, full_name').eq('id', params.id).eq('shop_id', user.shop_id).single()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'owner' && user.role !== 'owner') return NextResponse.json({ error: 'Cannot modify owner account' }, { status: 403 })

  const body = await req.json()
  const updateable = ['role','team','language','telegram_id','active','full_name']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  const { data, error } = await supabase.from('users').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (update.role && update.role !== target.role) {
    await log('user.role_changed', user.shop_id, user.id, { table:'users', recordId:params.id, oldData:{ role: target.role }, newData:{ role: update.role } })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['owner','gm','it_person'].includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  if (params.id === user.id) return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })

  await supabase.from('users').update({ active: false }).eq('id', params.id).eq('shop_id', user.shop_id)
  await log('user.deleted', user.shop_id, user.id, { table:'users', recordId:params.id })
  return NextResponse.json({ success: true })
}
