import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function verifyCron(req: Request) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

async function sendTG(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const today     = new Date()
  const threeDays = new Date(today.getTime() + 3 * 86400000).toISOString().split('T')[0]

  const { data: duePMs } = await getSupabase()
    .from('pm_schedules')
    .select('service_name, next_due_date, assets(unit_number), shops(id, name, dba)')
    .eq('active', true)
    .lte('next_due_date', threeDays)
    .order('next_due_date')

  if (!duePMs?.length) return NextResponse.json({ sent: 0 })

  const byShop: Record<string, any[]> = {}
  for (const pm of duePMs) {
    const id = (pm.shops as any)?.id
    if (id) { if (!byShop[id]) byShop[id] = []; byShop[id].push(pm) }
  }

  let sent = 0
  for (const [shopId, pms] of Object.entries(byShop)) {
    const { data: mgr } = await getSupabase().from('users').select('telegram_id').eq('shop_id', shopId).in('role', ['fleet_manager','maintenance_manager','owner','gm']).not('telegram_id','is',null).limit(1).single()
    if (!mgr?.telegram_id) continue
    const list = pms.map(p => {
      const isOver = p.next_due_date < today.toISOString().split('T')[0]
      return `${isOver?'🔴':'🟡'} Unit #${(p.assets as any)?.unit_number} — ${p.service_name} (${isOver?'OVERDUE':'due '+p.next_due_date})`
    }).join('\n')
    await sendTG(mgr.telegram_id, `🔧 *PM ALERTS — ${pms.length} due*\n\n${list}\n\n${process.env.NEXT_PUBLIC_APP_URL}/maintenance`)
    sent++
  }
  return NextResponse.json({ sent, count: duePMs.length })
}
