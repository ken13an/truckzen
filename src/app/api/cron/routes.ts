// ============================================================
// CRON JOB ROUTES
// Triggered by Vercel cron (vercel.json) — runs on schedule
// Protected by CRON_SECRET so only Vercel can call them
// ============================================================

// ── app/api/cron/pm-alerts/route.ts ─────────────────────────
// Runs: daily at 7am (see vercel.json)
// Finds PM schedules due within 3 days or overdue
// Sends Telegram alert to Fleet Manager

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function verifyCron(req: Request) {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

async function sendTG(chatId: number, text: string) {
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

// PM ALERTS
export async function GET_PM(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const today     = new Date()
  const threeDays = new Date(today.getTime() + 3 * 86400000).toISOString().split('T')[0]

  // Find all overdue or upcoming PM schedules
  const { data: duePMs } = await getSupabase()
    .from('pm_schedules')
    .select(`
      service_name, next_due_date, next_due_reading,
      assets(unit_number, year, make, model, odometer),
      shops(id, name, dba)
    `)
    .eq('active', true)
    .lte('next_due_date', threeDays)
    .order('next_due_date')

  if (!duePMs?.length) return NextResponse.json({ sent: 0 })

  // Group by shop
  const byShop: Record<string, typeof duePMs> = {}
  for (const pm of duePMs) {
    const shopId = (pm.shops as any)?.id
    if (!byShop[shopId]) byShop[shopId] = []
    byShop[shopId].push(pm)
  }

  let sent = 0
  for (const [shopId, pms] of Object.entries(byShop)) {
    // Find fleet manager for this shop
    const { data: mgr } = await getSupabase()
      .from('users')
      .select('telegram_id, full_name')
      .eq('shop_id', shopId)
      .in('role', ['fleet_manager', 'maintenance_manager', 'owner', 'gm'])
      .not('telegram_id', 'is', null)
      .limit(1)
      .single()

    if (!mgr?.telegram_id) continue

    const overdueList = pms
      .map(p => {
        const asset   = p.assets as any
        const dueDate = new Date(p.next_due_date!)
        const isOver  = dueDate < today
        return `${isOver ? '[OVERDUE]' : '[DUE]'} Unit #${asset?.unit_number} — ${p.service_name} (${isOver ? 'OVERDUE' : 'due ' + p.next_due_date})`
      })
      .join('\n')

    await sendTG(mgr.telegram_id,
      `*PM ALERTS — ${pms.length} due*\n\n${overdueList}\n\nView all: ${process.env.NEXT_PUBLIC_APP_URL}/maintenance`
    )
    sent++
  }

  return NextResponse.json({ sent, pm_count: duePMs.length })
}

// COMPLIANCE ALERTS
export async function GET_COMPLIANCE(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const today      = new Date()
  const thirtyDays = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]

  const { data: expiring } = await getSupabase()
    .from('compliance_items')
    .select(`
      item_type, document_name, expiry_date,
      assets(unit_number),
      drivers(full_name),
      shops(id, name)
    `)
    .lte('expiry_date', thirtyDays)
    .order('expiry_date')

  if (!expiring?.length) return NextResponse.json({ sent: 0 })

  const byShop: Record<string, typeof expiring> = {}
  for (const item of expiring) {
    const shopId = (item.shops as any)?.id
    if (!byShop[shopId]) byShop[shopId] = []
    byShop[shopId].push(item)
  }

  let sent = 0
  for (const [shopId, items] of Object.entries(byShop)) {
    const { data: mgr } = await getSupabase()
      .from('users')
      .select('telegram_id')
      .eq('shop_id', shopId)
      .in('role', ['fleet_manager', 'office_admin', 'owner', 'gm'])
      .not('telegram_id', 'is', null)
      .limit(1)
      .single()

    if (!mgr?.telegram_id) continue

    const list = items.map(i => {
      const who   = (i.assets as any)?.unit_number ? `Unit #${(i.assets as any).unit_number}` : (i.drivers as any)?.full_name || '—'
      const daysLeft = Math.ceil((new Date(i.expiry_date).getTime() - today.getTime()) / 86400000)
      const icon  = daysLeft < 0 ? '[EXPIRED]' : daysLeft <= 7 ? '[WARNING]' : '[DUE]'
      return `${icon} ${who} — ${i.document_name} (${daysLeft < 0 ? `${Math.abs(daysLeft)}d EXPIRED` : `${daysLeft}d left`})`
    }).join('\n')

    await sendTG(mgr.telegram_id,
      `*COMPLIANCE ALERTS — ${items.length} items*\n\n${list}\n\nView all: ${process.env.NEXT_PUBLIC_APP_URL}/compliance`
    )
    sent++
  }

  return NextResponse.json({ sent, item_count: expiring.length })
}

// INVOICE REMINDERS
export async function GET_INVOICES(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const today = new Date().toISOString().split('T')[0]

  // Find overdue invoices (past due date, not paid, not voided)
  const { data: overdue } = await getSupabase()
    .from('invoices')
    .select(`
      id, invoice_number, balance_due, due_date,
      customers(company_name, phone, email),
      shops(id, name)
    `)
    .in('status', ['sent'])
    .lt('due_date', today)
    .gt('balance_due', 0)
    .order('due_date')

  if (!overdue?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

  const byShop: Record<string, typeof overdue> = {}
  for (const inv of overdue) {
    const shopId = (inv.shops as any)?.id
    if (!byShop[shopId]) byShop[shopId] = []
    byShop[shopId].push(inv)
  }

  for (const [shopId, invs] of Object.entries(byShop)) {
    const { data: acct } = await getSupabase()
      .from('users')
      .select('telegram_id')
      .eq('shop_id', shopId)
      .in('role', ['accountant', 'office_admin', 'owner', 'gm'])
      .not('telegram_id', 'is', null)
      .limit(1)
      .single()

    if (!acct?.telegram_id) continue

    const total = invs.reduce((s, i) => s + (i.balance_due || 0), 0)
    const list  = invs.slice(0, 8).map(i => {
      const daysOver = Math.ceil((new Date().getTime() - new Date(i.due_date!).getTime()) / 86400000)
      const cust     = (i.customers as any)?.company_name || '—'
      return `${i.invoice_number} — ${cust} — $${i.balance_due?.toFixed(0)} (${daysOver}d overdue)`
    }).join('\n')

    await sendTG(acct.telegram_id,
      `*OVERDUE INVOICES — ${invs.length} total · $${total.toFixed(0)}*\n\n${list}\n\nView all: ${process.env.NEXT_PUBLIC_APP_URL}/invoices`
    )

    // Mark alert_sent on each (add this column if needed)
    sent++
  }

  return NextResponse.json({ sent, invoice_count: overdue.length })
}

// ── ACTUAL ROUTE EXPORTS ─────────────────────────────────────
// Each cron runs as its own route file. Export the correct handler:

// In /api/cron/pm-alerts/route.ts → export { GET_PM as GET }
// In /api/cron/compliance-alerts/route.ts → export { GET_COMPLIANCE as GET }
// In /api/cron/invoice-reminders/route.ts → export { GET_INVOICES as GET }

export const GET = GET_PM  // default export for this file
