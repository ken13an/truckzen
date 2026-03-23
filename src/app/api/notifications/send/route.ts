import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const s = db()
  const { user_ids, role, shop_id, title, body, data } = await req.json()

  if (!title || !body) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 })
  }

  // Get push tokens - either by user IDs or by role+shop
  let tokens: string[] = []

  if (user_ids?.length) {
    const { data: users } = await s.from('users')
      .select('push_token')
      .in('id', user_ids)
      .is('deleted_at', null)
      .not('push_token', 'is', null)
    tokens = (users || []).map((u: any) => u.push_token).filter(Boolean)
  } else if (role && shop_id) {
    const { data: users } = await s.from('users')
      .select('push_token')
      .eq('shop_id', shop_id)
      .eq('role', role)
      .is('deleted_at', null)
      .not('push_token', 'is', null)
    tokens = (users || []).map((u: any) => u.push_token).filter(Boolean)
  }

  if (tokens.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No push tokens found' })
  }

  // Send via Expo Push API
  const messages = tokens.map(token => ({
    to: token,
    title,
    body,
    data: data || {},
    sound: 'default' as const,
  }))

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    })
    const result = await res.json()
    return NextResponse.json({ sent: messages.length, result })
  } catch (err) {
    console.error('[Push] Send failed:', err)
    return NextResponse.json({ error: 'Push send failed' }, { status: 500 })
  }
}
