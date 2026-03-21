import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToRole } from '@/lib/services/notifications'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const body = await req.json()
  const { action, user_id } = body

  if (!action || !['check', 'send_to_accounting'].includes(action)) {
    return NextResponse.json({ error: 'action must be check or send_to_accounting' }, { status: 400 })
  }

  // Fetch WO with lines, assignments, and time entries
  const { data: wo, error: woErr } = await s
    .from('service_orders')
    .select('id, so_number, shop_id, status, invoice_status, so_lines(id, line_type, description, part_number, quantity, unit_price, total_price, line_status, labor_minutes)')
    .eq('id', id)
    .single()

  if (woErr || !wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

  const lines = (wo as any).so_lines || []
  const laborLines = lines.filter((l: any) => l.line_type === 'labor')
  const partLines = lines.filter((l: any) => l.line_type === 'part')
  const lineIds = lines.map((l: any) => l.id)

  // Fetch job assignments for all lines
  let assignments: any[] = []
  if (lineIds.length > 0) {
    const { data: ja } = await s.from('wo_job_assignments').select('id, line_id').in('line_id', lineIds)
    assignments = ja || []
  }

  // Fetch time entries for all lines
  let timeEntries: any[] = []
  if (lineIds.length > 0) {
    const { data: te } = await s.from('so_time_entries').select('id, so_line_id, duration_minutes').eq('service_order_id', id)
    timeEntries = te || []
  }

  // Run quality checks
  const errors: string[] = []

  // 1. All labor lines have at least one assignment
  for (const line of laborLines) {
    const hasAssignment = assignments.some((a: any) => a.line_id === line.id)
    if (!hasAssignment) {
      errors.push(`Labor line "${line.description}" has no mechanic assigned`)
    }
  }

  // 2. All labor lines have labor_minutes > 0 OR have time entries
  for (const line of laborLines) {
    const hasMinutes = line.labor_minutes && line.labor_minutes > 0
    const hasTimeEntries = timeEntries.some((te: any) => te.so_line_id === line.id && te.duration_minutes > 0)
    if (!hasMinutes && !hasTimeEntries) {
      errors.push(`Labor line "${line.description}" has no labor time recorded`)
    }
  }

  // 3. All part lines have unit_price > 0
  for (const line of partLines) {
    if (!line.unit_price || line.unit_price <= 0) {
      errors.push(`Part "${line.description}" has no price set`)
    }
  }

  // 4. No duplicate part descriptions on same WO
  const partDescs = partLines.map((l: any) => (l.description || '').trim().toLowerCase())
  const seen = new Set<string>()
  for (const desc of partDescs) {
    if (desc && seen.has(desc)) {
      errors.push(`Duplicate part: "${desc}"`)
    }
    seen.add(desc)
  }

  // 5. All labor lines have line_status = 'completed'
  for (const line of laborLines) {
    if (line.line_status !== 'completed') {
      errors.push(`Labor line "${line.description}" is not completed (status: ${line.line_status || 'unassigned'})`)
    }
  }

  const passed = errors.length === 0

  if (action === 'send_to_accounting' && passed) {
    await s.from('service_orders').update({
      invoice_status: 'pending_accounting',
      quality_check_errors: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    // Log activity
    if (user_id) {
      await s.from('wo_activity_log').insert({ wo_id: id, user_id, action: 'Sent to accounting for review' })
    }

    // Notify accounting users
    sendPushToRole(wo.shop_id, 'accountant', 'Invoice Ready for Review', `WO-${wo.so_number} is ready for accounting review`).catch(() => {})
    sendPushToRole(wo.shop_id, 'owner', 'Invoice Ready for Review', `WO-${wo.so_number} is ready for accounting review`).catch(() => {})

    return NextResponse.json({ passed: true, errors: [] })
  }

  if (!passed) {
    await s.from('service_orders').update({
      invoice_status: 'quality_check_failed',
      quality_check_errors: errors,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
  }

  return NextResponse.json({ passed, errors })
}
