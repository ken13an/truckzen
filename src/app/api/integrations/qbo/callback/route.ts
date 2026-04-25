// app/api/integrations/qbo/callback/route.ts
import { NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/integrations/quickbooks'
import { verifyQboState } from '@/lib/integrations/qbo-oauth-state'

// QBO OAuth callback. The `state` parameter is a HMAC-signed payload built
// by /api/integrations/qbo/connect — it carries the shop_id + user_id that
// initiated the flow. We verify the signature and expiry, then derive
// shop_id from the verified payload only. Query/body shop_id is never
// trusted.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=error`)
  }

  const verified = verifyQboState(state)
  if (!verified) {
    console.warn('[qbo-callback] invalid or expired state')
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=error`)
  }

  const success = await exchangeCodeForTokens(code, verified.shop_id)

  if (!success) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=error`)
  }

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=connected`)
}
