// Unified notification sender — in-app + Telegram
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function notifyUser(opts: {
  shopId: string
  userId: string
  title: string
  body?: string
  link?: string
}) {
  const s = db()
  // In-app notification
  await s.from('notifications').insert({
    shop_id: opts.shopId,
    user_id: opts.userId,
    title: opts.title,
    body: opts.body || null,
    link: opts.link || null,
  })

  // Telegram notification
  const { data: user } = await s.from('users').select('telegram_id').eq('id', opts.userId).single()
  if (user?.telegram_id) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (token && token !== 'your_token_here') {
      const text = `${opts.title}${opts.body ? '\n' + opts.body : ''}${opts.link ? '\n' + opts.link : ''}`
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.telegram_id, text, parse_mode: 'Markdown' }),
      }).catch(() => {})
    }
  }
}

export async function notifyRole(opts: {
  shopId: string
  role: string | string[]
  title: string
  body?: string
  link?: string
}) {
  const s = db()
  const roles = Array.isArray(opts.role) ? opts.role : [opts.role]
  const { data: users } = await s.from('users').select('id')
    .eq('shop_id', opts.shopId)
    .in('role', roles)
    .eq('active', true)

  for (const u of users || []) {
    await notifyUser({ ...opts, userId: u.id })
  }
}
