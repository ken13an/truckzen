import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { ADMIN_ROLES } from '@/lib/roles'

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('drivers')
    .select('*, customers(company_name), dvir_submissions(id, submitted_at, defects_found, trip_type)')
    .eq('id', id)
    .eq('shop_id', user.shop_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','fleet_manager','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const updateable = ['full_name','phone','email','cdl_number','cdl_class','cdl_expiry','medical_card_expiry','customer_id','status','notes']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  const { data, error } = await supabase.from('drivers').update(update).eq('id', id).eq('shop_id', user.shop_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!ADMIN_ROLES.includes(user.role))
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  await supabase.from('drivers').update({ status: 'inactive' }).eq('id', id).eq('shop_id', user.shop_id)
  return NextResponse.json({ success: true })
}
