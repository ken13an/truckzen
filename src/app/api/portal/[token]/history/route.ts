import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

export async function GET(_req: Request, { params }: P) {
  const { token } = await params
  const s = db()

  const { data: wo } = await s.from('service_orders').select('customer_id').eq('portal_token', token).single()
  if (!wo || !wo.customer_id) return NextResponse.json([])

  const { data } = await s.from('service_orders')
    .select('id, so_number, status, complaint, grand_total, created_at, portal_token, assets(unit_number, year, make, model)')
    .eq('customer_id', wo.customer_id)
    .not('status', 'eq', 'void')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json(data || [])
}
