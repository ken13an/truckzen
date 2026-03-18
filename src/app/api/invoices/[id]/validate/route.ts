import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { validateInvoiceBeforeClose } from '@/lib/security'

type P = { params: { id: string } }

export async function GET(_req: Request, { params }: P) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await validateInvoiceBeforeClose(params.id, user.shop_id)
  return NextResponse.json(result)
}
