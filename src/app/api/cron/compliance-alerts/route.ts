import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today      = new Date()
  const thirtyDays = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]

  const { data: expiring } = await supabase
    .from('compliance_items')
    .select('item_type, document_name, expiry_date, assets(unit_number), drivers(full_name), shops(id, name)')
    .lte('expiry_date', thirtyDays)
    .order('expiry_date')

  if (!expiring?.length) return NextResponse.json({ sent: 0 })

  const byShop: Record<string, any[]> = {}
  for (const item of expiring) {
    const id = (item.shops as any)?.id
    if (id) { if (!byShop[id]) byShop[id] = []; byShop[id].push(item) }
  }

  let sent = 0
  for (const [shopId, items] of Object.entries(byShop)) {
    const { data: mgr } = await supabase.from('users').select('telegram_id').eq('shop_id', shopId).in('role', ['fleet_manager','office_admin','owner','gm']).not('telegram_id','is',null).limit(1).single()
    if (!mgr?.telegram_id) continue

    const list = items.map(i => {
      const who      = (i.assets as any)?.unit_number ? `Unit #${(i.assets as any).unit_number}` : (i.drivers as any)?.full_name || '—'
      const daysLeft = Math.ceil((new Date(i.expiry_date).getTime() - today.getTime()) / 86400000)
      const icon     = daysLeft < 0 ? '🔴' : daysLeft <= 7 ? '🟠' : '🟡'
      return `${icon} ${who} — ${i.document_name} (${daysLeft < 0 ? Math.abs(daysLeft)+'d EXPIRED' : daysLeft+'d left'})`
    }).join('\n')

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: mgr.telegram_id, text: `📋 *COMPLIANCE — ${items.length} expiring*\n\n${list}\n\n${process.env.NEXT_PUBLIC_APP_URL}/compliance`, parse_mode: 'Markdown' }),
    })
    sent++
  }
  return NextResponse.json({ sent, count: expiring.length })
}
