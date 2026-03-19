import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { log } from '@/lib/security'

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('assets')
    .select('*, customers(id, company_name, phone, email)')
    .eq('id', id)
    .eq('shop_id', user.shop_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','fleet_manager','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const { data: current } = await supabase.from('assets').select('*').eq('id', id).eq('shop_id', user.shop_id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateable = ['unit_number','vin','year','make','model','engine','odometer','status','customer_id','notes']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  const { data, error } = await supabase.from('assets').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await log('so.updated' as any, user.shop_id, user.id, {
    table: 'assets', recordId: id,
    oldData: current, newData: update,
  })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['owner','gm','it_person'].includes(user.role))
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  await supabase.from('assets').update({ status: 'decommissioned' }).eq('id', id).eq('shop_id', user.shop_id)
  return NextResponse.json({ success: true })
}
