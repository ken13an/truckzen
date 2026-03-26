import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.shopId || !ctx.admin) return ctx.error!

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const soId = searchParams.get('so_id')

  let q = ctx.admin.from('parts_requests')
    .select('*, service_orders:so_id(id, so_number, status, assigned_tech, assets(unit_number, year, make, model), customers(id, company_name, pricing_tier), users!assigned_tech(full_name)), requester:requested_by(full_name), submitter:submitted_by(full_name)')
    .eq('shop_id', ctx.shopId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    q = status === 'active' ? q.in('status', ['pending', 'requested', 'reviewing', 'submitted', 'partial']) : q.eq('status', status)
  }
  if (soId) q = q.eq('so_id', soId)

  const { data, error } = await q.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
