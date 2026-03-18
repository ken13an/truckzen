// ── api/maintenance/[id]/route.ts ────────────────────────────
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updateable = ['service_name','interval_miles','interval_days','next_due_date','next_due_reading','last_service_date','last_service_reading','notes','active']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  const { data, error } = await supabase.from('pm_schedules').update(update).eq('id', id).eq('shop_id', user.shop_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await supabase.from('pm_schedules').update({ active: false }).eq('id', id).eq('shop_id', user.shop_id)
  return NextResponse.json({ success: true })
}

export { PATCH as GET }
