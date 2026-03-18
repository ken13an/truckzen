// app/api/integrations/qbo/callback/route.ts
import { NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/integrations/quickbooks'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code    = searchParams.get('code')
  const shopId  = searchParams.get('state')  // shopId passed through OAuth state
  const error   = searchParams.get('error')

  if (error || !code || !shopId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=error`)
  }

  const success = await exchangeCodeForTokens(code, shopId)

  if (!success) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=error`)
  }

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=connected`)
}
