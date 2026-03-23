import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data } = await s.from('parts_requests')
    .select('*, users:requested_by(full_name)')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json(data || [])
}

export async function PATCH(req: Request) {
  const s = db()
  const { id, action, reason, in_stock, user_id } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  const now = new Date().toISOString()

  if (action === 'approve') {
    const update: any = { status: in_stock ? 'in_stock' : 'ordered', approved_by_user_id: user_id, approved_at: now }
    if (in_stock) { update.in_stock = true; update.ready_at = now }
    else { update.in_stock = false; update.ordered_at = now }
    await s.from('parts_requests').update(update).eq('id', id)
  } else if (action === 'deny') {
    await s.from('parts_requests').update({ status: 'rejected', rejected_reason: reason || null }).eq('id', id)
  } else if (action === 'ready') {
    await s.from('parts_requests').update({ status: 'ready', ready_at: now }).eq('id', id)
  } else if (action === 'picked_up') {
    await s.from('parts_requests').update({ status: 'picked_up', picked_up_at: now }).eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
