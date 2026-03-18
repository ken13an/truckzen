import { createClient } from "@supabase/supabase-js"
// app/api/integrations/qbo/callback/route.ts
import { NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/integrations/quickbooks'

export async function GET(req: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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
