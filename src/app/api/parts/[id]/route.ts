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
    .from('parts')
    .select('*')
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

  const allowed = ['owner','gm','it_person','shop_manager','parts_manager','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const { data: current } = await supabase.from('parts').select('*').eq('id', id).eq('shop_id', user.shop_id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateable = ['part_number','description','category','on_hand','reorder_point','cost_price','sell_price','vendor','bin_location','core_charge','warranty_months']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  const { data, error } = await supabase.from('parts').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (update.on_hand !== undefined && update.on_hand !== current.on_hand) {
    await log('parts.quantity_changed', user.shop_id, user.id, { table:'parts', recordId:id, oldData:{ on_hand: current.on_hand }, newData:{ on_hand: update.on_hand } })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['owner','gm','it_person'].includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { data: part } = await supabase.from('parts').select('description').eq('id', id).single()
  await supabase.from('parts').update({ active: false }).eq('id', id).eq('shop_id', user.shop_id)
  await log('parts.removed', user.shop_id, user.id, { table:'parts', recordId:id, oldData: part })
  return NextResponse.json({ success: true })
}
