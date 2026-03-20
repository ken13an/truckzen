import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getUser(req: Request) {
  const s = db()
  // Get auth token from cookie or Authorization header
  const cookieHeader = req.headers.get('cookie') || ''
  const authHeader = req.headers.get('authorization') || ''

  // Try to get user from Supabase auth
  // For client-side fetches, the browser sends cookies automatically
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Extract access token from cookies
  const tokenMatch = cookieHeader.match(/sb-[^=]+-auth-token[^=]*=([^;]+)/)
  let userId: string | null = null

  if (tokenMatch) {
    try {
      const parsed = JSON.parse(decodeURIComponent(tokenMatch[1]))
      const accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token
      if (accessToken) {
        const { data } = await anonClient.auth.getUser(accessToken)
        userId = data?.user?.id || null
      }
    } catch {}
  }

  if (!userId && authHeader.startsWith('Bearer ')) {
    const { data } = await anonClient.auth.getUser(authHeader.slice(7))
    userId = data?.user?.id || null
  }

  if (!userId) return null

  const { data: profile } = await s.from('users').select('id, shop_id, full_name, role, team').eq('id', userId).single()
  return profile
}

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: so, error } = await s
    .from('service_orders')
    .select(`
      *,
      assets(id, unit_number, year, make, model, vin, odometer, engine),
      customers(id, company_name, contact_name, phone, email),
      users!assigned_tech(id, full_name, role, team),
      so_lines(id, line_type, description, part_number, quantity, unit_price, total_price, created_at),
      invoices(id, invoice_number, status, total, balance_due)
    `)
    .eq('id', id)
    .eq('shop_id', user.shop_id)
    .single()

  if (error || !so) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const limitedRoles = ['technician', 'maintenance_technician']
  if (limitedRoles.includes(user.role) && user.team && (so as any).team !== user.team) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  return NextResponse.json(so)
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: current } = await s
    .from('service_orders')
    .select('*')
    .eq('id', id)
    .eq('shop_id', user.shop_id)
    .single()

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const unlimitedRoles = ['owner', 'gm', 'it_person', 'shop_manager']
  const advisorRoles = ['service_writer', 'office_admin', 'accountant']
  const techRoles = ['technician', 'maintenance_technician']

  let allowedFields: string[]
  if (unlimitedRoles.includes(user.role)) {
    allowedFields = ['status', 'priority', 'team', 'bay', 'assigned_tech', 'complaint', 'cause', 'correction', 'internal_notes', 'customer_id', 'grand_total', 'due_date']
  } else if (advisorRoles.includes(user.role)) {
    allowedFields = ['status', 'priority', 'team', 'bay', 'assigned_tech', 'complaint', 'cause', 'correction', 'customer_id', 'due_date']
  } else if (techRoles.includes(user.role)) {
    allowedFields = ['status', 'cause', 'correction', 'internal_notes']
  } else {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const update: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  update.updated_at = new Date().toISOString()
  if (update.status === 'good_to_go' && current.status !== 'good_to_go') {
    update.completed_at = new Date().toISOString()
  }

  const { data: updated, error } = await s
    .from('service_orders')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (update.status && update.status !== current.status) {
    try {
      await s.from('audit_log').insert({
        shop_id: user.shop_id,
        user_id: user.id,
        action: 'so.status_changed',
        details: { table: 'service_orders', recordId: id, old_status: current.status, new_status: update.status },
      })
    } catch {}
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['owner', 'gm', 'it_person'].includes(user.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  await s.from('service_orders').update({ status: 'void', updated_at: new Date().toISOString() }).eq('id', id).eq('shop_id', user.shop_id)

  return NextResponse.json({ success: true })
}
