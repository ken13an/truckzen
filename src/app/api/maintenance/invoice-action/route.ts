import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

const ALLOWED_ROLES = ['maintenance_manager', 'fleet_manager', 'owner', 'gm', 'it_person', 'shop_manager']
const VALID_ACTIONS = ['approve', 'flag_issue', 'payment_sent']

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!ALLOWED_ROLES.includes(actor.role)) return jsonError('Forbidden', 403)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const { wo_id, action, notes } = await req.json()
  if (!wo_id || !action) return NextResponse.json({ error: 'wo_id and action required' }, { status: 400 })
  if (!VALID_ACTIONS.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const s = db()

  // Verify WO belongs to this shop
  const { data: wo } = await s.from('service_orders').select('id, so_number, shop_id').eq('id', wo_id).single()
  if (!wo || wo.shop_id !== shopId) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

  const actionLabels: Record<string, string> = {
    approve: 'Maintenance approved invoice',
    flag_issue: 'Maintenance flagged issue',
    payment_sent: 'Maintenance: payment sent',
  }

  const logText = `${actionLabels[action]}${notes ? ': ' + notes : ''} — by ${actor.full_name || 'Maintenance'}`

  // Log to activity
  await s.from('wo_activity_log').insert({ wo_id, user_id: actor.id, action: logText })

  // Notify accounting / service writer roles
  const { data: targets } = await s.from('users')
    .select('id')
    .eq('shop_id', shopId)
    .in('role', ['accountant', 'accounting_manager', 'service_writer', 'office_admin', 'owner'])
    .or('is_autobot.is.null,is_autobot.eq.false')

  const notifTitle: Record<string, string> = {
    approve: `Invoice Approved: WO #${wo.so_number}`,
    flag_issue: `Invoice Issue Flagged: WO #${wo.so_number}`,
    payment_sent: `Payment Sent: WO #${wo.so_number}`,
  }

  for (const t of targets || []) {
    if (t.id === actor.id) continue // don't self-notify
    await s.from('notifications').insert({
      shop_id: shopId, user_id: t.id, type: 'maintenance_invoice_action',
      title: notifTitle[action],
      message: logText,
      link: `/work-orders/${wo_id}`,
    })
  }

  return NextResponse.json({ ok: true })
}
