import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type P = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const { partial } = await req.json().catch(() => ({ partial: false }))

  const now = new Date().toISOString()
  const { data, error } = await s.from('parts_requests')
    .update({
      status: partial ? 'partial' : 'ready',
      parts_ready_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .select('*, service_orders:so_id(so_number, shop_id, assigned_tech, assets(unit_number))')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify mechanic
  const wo = (data as any).service_orders
  if (wo?.assigned_tech) {
    const soNum = wo.so_number || ''
    const unit = wo.assets?.unit_number || ''

    // Count ordered items for partial message
    const lineItems = (data as any).line_items || []
    const orderedCount = lineItems.filter((l: any) => l.ordered && !l.in_stock).length

    const title = partial ? 'Some Parts Ready' : 'Parts Ready for Pickup'
    const body = partial
      ? `Some parts ready for WO #${soNum} — ${orderedCount} part${orderedCount !== 1 ? 's' : ''} still on order`
      : `Parts are ready — pick up for WO #${soNum} — ${unit}`

    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: [wo.assigned_tech], title, body }),
      })
    } catch {}
  }

  return NextResponse.json(data)
}
