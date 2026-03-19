import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/service-requests?shop_id=...&status=...
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const status = searchParams.get('status')

  let q = s.from('service_requests')
    .select('id, shop_id, customer_id, asset_id, unit_number, company_name, contact_name, phone, description, source, status, reject_reason, scheduled_date, converted_so_id, created_by, created_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data, error } = await q.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/service-requests — convert, schedule, or reject
export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { action, request_id, shop_id, user_id } = body

  if (!request_id || !action) return NextResponse.json({ error: 'request_id and action required' }, { status: 400 })

  const { data: sr } = await s.from('service_requests').select('*').eq('id', request_id).single()
  if (!sr) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  switch (action) {
    case 'convert': {
      // Generate SO number
      const { count } = await s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', sr.shop_id)
      const year = new Date().getFullYear()
      const soNum = `SO-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

      // Create service order from request
      const { data: so, error: soErr } = await s.from('service_orders').insert({
        shop_id: sr.shop_id,
        so_number: soNum,
        asset_id: sr.asset_id || null,
        customer_id: sr.customer_id || null,
        complaint: sr.description,
        source: 'kiosk',
        priority: 'normal',
        status: 'draft',
        advisor_id: user_id || null,
      }).select().single()

      if (soErr) return NextResponse.json({ error: soErr.message }, { status: 500 })

      // Update request status
      await s.from('service_requests').update({ status: 'converted', converted_so_id: so.id }).eq('id', request_id)

      // Also update the kiosk_checkin if linked
      if (sr.kiosk_checkin_id) {
        await s.from('kiosk_checkins').update({ converted_so_id: so.id, status: 'converted' }).eq('id', sr.kiosk_checkin_id)
      }

      return NextResponse.json({ ok: true, so_id: so.id, so_number: so.so_number })
    }

    case 'schedule': {
      const { scheduled_date } = body
      if (!scheduled_date) return NextResponse.json({ error: 'scheduled_date required' }, { status: 400 })
      await s.from('service_requests').update({ status: 'scheduled', scheduled_date }).eq('id', request_id)
      return NextResponse.json({ ok: true })
    }

    case 'reject': {
      const { reason } = body
      await s.from('service_requests').update({ status: 'rejected', reject_reason: reason || 'Rejected' }).eq('id', request_id)
      if (sr.kiosk_checkin_id) {
        await s.from('kiosk_checkins').update({ status: 'rejected' }).eq('id', sr.kiosk_checkin_id)
      }
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
