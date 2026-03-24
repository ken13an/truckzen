import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const role = searchParams.get('role')
  if (!shopId || !role) return NextResponse.json([])

  const { data } = await db().from('role_permissions').select('module, allowed').eq('shop_id', shopId).eq('role', role)
  return NextResponse.json(data || [])
}
