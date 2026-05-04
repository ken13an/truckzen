import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { rateLimit } from '@/lib/ratelimit/core'

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const burstLimit = await rateLimit('notify-user', actor.id)
  if (!burstLimit.allowed) return NextResponse.json({ error: 'Too many notification requests' }, { status: 429 })

  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { user_ids, role, title, body, data } = await req.json()

  if (!title || !body) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 })
  }

  // Get push tokens - scoped to actor's shop
  let tokens: string[] = []

  if (user_ids?.length) {
    const { data: users } = await s.from('users')
      .select('push_token')
      .in('id', user_ids)
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .not('push_token', 'is', null)
    tokens = (users || []).map((u: any) => u.push_token).filter(Boolean)
  } else if (role) {
    const { data: users } = await s.from('users')
      .select('push_token')
      .eq('shop_id', shopId)
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
    // Parse defensively — non-JSON error bodies on upstream failure shouldn't
    // throw and re-route through the network catch.
    const result = await res.json().catch(() => null)
    // Truthful delivery: only the request reaching upstream successfully
    // counts as 'sent'. HTTP 4xx/5xx from Expo previously fell through to
    // the success return below; clients now see the upstream failure
    // surface as 502 with the provider's status + body for diagnosis.
    // Per-token errors that come back inside a 200 response (Expo's
    // {data:[{status:'error',...}]} shape) are out of this patch's scope.
    if (!res.ok) {
      console.error('[Push] Upstream error:', { status: res.status, result })
      return NextResponse.json(
        { error: 'Push provider error', upstream_status: res.status, result },
        { status: 502 },
      )
    }
    return NextResponse.json({ sent: messages.length, result })
  } catch (err) {
    console.error('[Push] Send failed:', err)
    return NextResponse.json({ error: 'Push send failed' }, { status: 500 })
  }
}
