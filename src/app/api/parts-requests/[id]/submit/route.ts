import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type P = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: P) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const user_id = actor.id

  const { id } = await params
  const s = db()
  const { line_items } = await req.json()

  const now = new Date().toISOString()
  const update: Record<string, any> = {
    status: 'submitted',
    submitted_at: now,
    submitted_by: user_id,
    updated_at: now,
  }
  if (line_items) update.line_items = line_items

  const { data, error } = await s.from('parts_requests').update(update).eq('id', id).select('*, service_orders:so_id(so_number, shop_id, assigned_tech, assets(unit_number))').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log to wo_activity_log
  const soId = (data as any).so_id
  if (soId && user_id) {
    await s.from('wo_activity_log').insert({ wo_id: soId, user_id, action: 'Parts submitted — supervisor and mechanic notified' })
  }

  // Send notifications to floor manager + mechanic
  const wo = (data as any).service_orders
  if (wo) {
    const soNum = wo.so_number || ''
    const unit = wo.assets?.unit_number || ''
    const title = 'Parts Being Prepared'
    const body = `Parts are being prepared for WO #${soNum} — ${unit}`

    // Notify floor managers
    const { data: managers } = await s.from('users')
      .select('id')
      .eq('shop_id', wo.shop_id)
      .in('role', ['owner', 'gm', 'it_person', 'shop_manager'])
      .eq('active', true)
    const managerIds = (managers || []).map((u: any) => u.id)

    // Notify assigned mechanic
    const techId = wo.assigned_tech
    const targetIds = [...new Set([...managerIds, ...(techId ? [techId] : [])])]

    if (targetIds.length > 0) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: targetIds, title, body }),
        })
      } catch {}
    }
  }

  // In-app notification
  if (wo) {
    try {
      const { createNotification } = await import('@/lib/createNotification')
      const soNum = wo.so_number || ''
      const unit = wo.assets?.unit_number || ''
      const managerIds = (await s.from('users').select('id').eq('shop_id', wo.shop_id).in('role', ['shop_manager', 'floor_manager'])).data?.map((u: any) => u.id) || []
      const techId = wo.assigned_tech
      const allIds = [...new Set([...managerIds, ...(techId ? [techId] : [])])]
      if (allIds.length > 0) {
        await createNotification({
          shopId: wo.shop_id, recipientId: allIds, type: 'parts_submitted',
          title: 'Parts Submitted', body: `Parts submitted for WO #${soNum} #${unit}`,
          link: `/work-orders/${(data as any).so_id}`, relatedUnit: unit,
        })
      }
    } catch {}
  }

  return NextResponse.json(data)
}
