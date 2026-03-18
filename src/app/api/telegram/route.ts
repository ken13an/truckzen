// app/api/telegram/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}
function getTgConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  return {
    token,
    secret: process.env.TELEGRAM_WEBHOOK_SECRET!,
    api: `https://api.telegram.org/bot${token}`,
  }
}

// ── VERIFY WEBHOOK SECRET ───────────────────────────────────
export async function POST(req: Request) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== getTgConfig().secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let update: any
  try { update = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const msg = update?.message
  if (!msg?.text) return NextResponse.json({ ok: true })

  const telegramId = msg.from?.id
  const chatId     = msg.chat?.id
  const text       = msg.text as string

  // Only respond to @servicewriter mentions
  if (!text.toLowerCase().includes('@servicewriter')) {
    return NextResponse.json({ ok: true })
  }

  const cleanText = text.replace(/@servicewriter/gi, '').trim()

  try {
    // Look up user by telegram ID
    const { data: user } = await getSupabase()
      .from('users')
      .select('id, shop_id, full_name, role, team, language')
      .eq('telegram_id', telegramId)
      .single()

    if (!user) {
      await sendTG(chatId, '❌ Your Telegram account is not linked to TruckZen.\nAsk your admin to link it in Settings → Users.')
      return NextResponse.json({ ok: true })
    }

    // Get shop context
    const { data: shop } = await getSupabase()
      .from('shops')
      .select('name, dba')
      .eq('id', user.shop_id)
      .single()

    // Get recent open SOs for context
    const { data: recentSOs } = await getSupabase()
      .from('service_orders')
      .select(`so_number, status, priority, assets(unit_number), customers(company_name), users!assigned_tech(full_name)`)
      .eq('shop_id', user.shop_id)
      .not('status', 'in', '("good_to_go","void")')
      .order('created_at', { ascending: false })
      .limit(20)

    const soContext = recentSOs?.map(s =>
      `${s.so_number}: truck ${(s.assets as any)?.unit_number} (${(s.customers as any)?.company_name}) — ${s.status}`
    ).join('\n') || 'No open orders'

    // Ask Claude what action to take
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: `You are TruckZen @servicewriter bot for ${shop?.dba || shop?.name}.
User: ${user.full_name} (${user.role}, Team ${user.team || 'All'})
Open SOs:\n${soContext}

Return ONLY valid JSON: { "action": string, "truck_number": string|null, "so_number": string|null, "data": object, "reply": string }
Actions: update_status | add_note | flag_parts | assign_tech | move_bay | close_job | get_status | unknown`,
      messages: [{ role: 'user', content: cleanText }],
    })

    let parsed: any = { action: 'unknown', reply: 'I didn\'t understand that.' }
    try {
      const txt = response.content[0].type === 'text' ? response.content[0].text : ''
      parsed = JSON.parse(txt.replace(/```json\n?/g,'').replace(/```\n?/g,''))
    } catch { /* use default */ }

    // Execute action and reply
    await executeAndReply(parsed, user, chatId)

    // Log to DB
    await getSupabase().from('telegram_messages').insert({
      shop_id:      user.shop_id,
      telegram_id:  telegramId,
      user_id:      user.id,
      message_text: cleanText,
      action_taken: parsed.action,
      action_data:  parsed,
      success:      true,
    })

  } catch (err: any) {
    console.error('Telegram bot error:', err)
    await sendTG(chatId, '⚠️ Something went wrong. Try again.')
  }

  return NextResponse.json({ ok: true })
}

// ── ACTION EXECUTOR ─────────────────────────────────────────
async function executeAndReply(parsed: any, user: any, chatId: number) {
  const { action, truck_number, so_number, data, reply } = parsed

  // Find SO by truck or SO number
  async function findSO() {
    let q = getSupabase()
      .from('service_orders')
      .select(`id, so_number, status, priority, team, bay, grand_total, customer_id, assets(unit_number), customers(company_name)`)
      .eq('shop_id', user.shop_id)
      .not('status', 'in', '("good_to_go","void")')
    if (so_number)    q = q.ilike('so_number', `%${so_number}%`)
    else if (truck_number) {
      const { data: asset } = await getSupabase().from('assets').select('id').eq('shop_id', user.shop_id).ilike('unit_number', `%${truck_number}%`).single()
      if (asset) q = q.eq('asset_id', asset.id)
    }
    const { data: so } = await q.order('created_at', { ascending: false }).limit(1).single()
    return so
  }

  switch (action) {
    case 'update_status': {
      const so = await findSO()
      if (!so) { await sendTG(chatId, `❌ No open SO found for truck #${truck_number}`); return }
      await getSupabase().from('service_orders').update({ status: data?.new_status || 'in_progress' }).eq('id', so.id)
      await sendTG(chatId, `✅ ${(so as any).so_number} → ${data?.new_status?.replace(/_/g,' ').toUpperCase()}\nTruck #${(so.assets as any)?.unit_number} · ${(so.customers as any)?.company_name}`)
      break
    }
    case 'add_note': {
      const so = await findSO()
      if (!so) { await sendTG(chatId, `❌ No open SO found`); return }
      const note = data?.note || reply || 'Note added'
      const ts   = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
      const { data: cur } = await getSupabase().from('service_orders').select('internal_notes').eq('id', so.id).single()
      const updated = `${cur?.internal_notes || ''}\n[${ts} — ${user.full_name}]: ${note}`.trim()
      await getSupabase().from('service_orders').update({ internal_notes: updated }).eq('id', so.id)
      await sendTG(chatId, `📝 Note added to ${(so as any).so_number} (Truck #${(so.assets as any)?.unit_number})\n"${note}"`)
      break
    }
    case 'flag_parts': {
      const so = await findSO()
      if (!so) { await sendTG(chatId, `❌ No open SO found`); return }
      await getSupabase().from('service_orders').update({ status: 'waiting_parts', priority: 'high' }).eq('id', so.id)
      await sendTG(chatId, `⚠️ ${(so as any).so_number} → WAITING PARTS\nTruck #${(so.assets as any)?.unit_number} · Parts Manager notified`)
      break
    }
    case 'close_job': {
      const so = await findSO()
      if (!so) { await sendTG(chatId, `❌ No open SO found`); return }
      await getSupabase().from('service_orders').update({ status: 'good_to_go', completed_at: new Date().toISOString() }).eq('id', so.id)
      await sendTG(chatId, `✅ ${(so as any).so_number} CLOSED — Good to Go\nTruck #${(so.assets as any)?.unit_number}\nTotal: $${(so as any).grand_total?.toFixed(2) || '—'}\nInvoice auto-generated`)
      break
    }
    case 'get_status': {
      const so = await findSO()
      if (!so) { await sendTG(chatId, `❌ Truck #${truck_number} has no open SO`); return }
      const s = so as any
      await sendTG(chatId, `🚛 Truck #${s.assets?.unit_number}\nSO: ${s.so_number}\nStatus: ${s.status?.replace(/_/g,' ').toUpperCase()}\nPriority: ${s.priority?.toUpperCase()}\nCustomer: ${s.customers?.company_name}`)
      break
    }
    default:
      await sendTG(chatId, reply || 'I didn\'t understand that. Try: "@servicewriter status truck 2717"')
  }
}

async function sendTG(chatId: number, text: string) {
  await fetch(`${getTgConfig().api}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}
