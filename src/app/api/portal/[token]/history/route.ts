import { NextResponse } from 'next/server'
import { checkPortalLimits } from '@/lib/ratelimit/portal-guard'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

export async function GET(req: Request, { params }: P) {
  const { token } = await params
  const _rl = await checkPortalLimits(req, token); if (_rl !== true) return _rl
  const s = db()

  const { data: wo } = await s.from('service_orders').select('customer_id').eq('portal_token', token).single()
  if (!wo || !wo.customer_id) return NextResponse.json([])

  // portal_token deliberately excluded from the response — exposing tokens
  // for sibling WOs let any single valid portal link pivot to all of the
  // customer's other tokens. The portal UI only renders so_number / status
  // / complaint / grand_total / created_at / asset summary.
  const { data } = await s.from('service_orders')
    .select('id, so_number, status, complaint, grand_total, created_at, assets(unit_number, year, make, model)')
    .eq('customer_id', wo.customer_id)
    .is('deleted_at', null)
    .not('status', 'eq', 'void')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json(data || [])
}
