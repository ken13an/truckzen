import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'
import { signQboState } from '@/lib/integrations/qbo-oauth-state'
import { getAuthUrl } from '@/lib/integrations/quickbooks'

// GET /api/integrations/qbo/connect — start the QBO OAuth flow.
// Authenticated actor required. Shop scope and user attribution are derived
// from the server session and embedded in the signed OAuth state. Body/query
// shop_id and user_id are not accepted.
export async function GET(_req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  let url: string
  try {
    const state = signQboState({ shop_id: shopId, user_id: ctx.actor.id })
    url = getAuthUrl(state)
  } catch (err: any) {
    console.error('[qbo-connect] failed to build authorize URL', { error: err?.message || String(err) })
    return NextResponse.json({ error: 'QBO connect not configured' }, { status: 500 })
  }

  return NextResponse.json({ url })
}
