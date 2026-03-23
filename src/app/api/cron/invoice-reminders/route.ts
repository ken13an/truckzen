import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: overdue } = await supabase
    .from('invoices')
    .select('id, invoice_number, balance_due, due_date, customers(company_name), shops(id, name)')
    .eq('status', 'sent')
    .is('deleted_at', null)
    .lt('due_date', today)
    .gt('balance_due', 0)
    .order('due_date')

  if (!overdue?.length) return NextResponse.json({ sent: 0 })

  const byShop: Record<string, any[]> = {}
  for (const inv of overdue) {
    const id = (inv.shops as any)?.id
    if (id) { if (!byShop[id]) byShop[id] = []; byShop[id].push(inv) }
  }

  let sent = 0
  for (const [shopId, invs] of Object.entries(byShop)) {
    const { data: acct } = await supabase.from('users').select('telegram_id').eq('shop_id', shopId).in('role', ['accountant','office_admin','owner','gm']).not('telegram_id','is',null).limit(1).single()
    if (!acct?.telegram_id) continue

    const total = invs.reduce((s, i) => s + (i.balance_due || 0), 0)
    const list  = invs.slice(0, 8).map(i => {
      const daysOver = Math.ceil((new Date().getTime() - new Date(i.due_date).getTime()) / 86400000)
      return `${i.invoice_number} — ${(i.customers as any)?.company_name} — $${i.balance_due?.toFixed(0)} (${daysOver}d over)`
    }).join('\n')

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: acct.telegram_id, text: `*OVERDUE INVOICES — ${invs.length} · $${total.toFixed(0)}*\n\n${list}\n\n${process.env.NEXT_PUBLIC_APP_URL}/invoices`, parse_mode: 'Markdown' }),
    })
    sent++
  }
  return NextResponse.json({ sent, count: overdue.length })
}
