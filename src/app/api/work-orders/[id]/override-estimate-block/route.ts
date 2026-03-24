import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const { user_id, reason } = await req.json()

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Check user role
  const { data: user } = await s.from('users').select('role, full_name').eq('id', user_id).single()
  if (!user || !['owner', 'gm', 'it_person', 'shop_manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Only owner, admin, GM, or shop manager can override' }, { status: 403 })
  }

  // Set estimate_approved = true with override
  await s.from('service_orders').update({
    estimate_approved: true,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  // Log override to activity
  await s.from('wo_activity_log').insert({
    wo_id: id,
    user_id,
    action: `Estimate block overridden by ${user.full_name}${reason ? ` — Reason: ${reason}` : ''}`,
  })

  return NextResponse.json({ ok: true })
}
