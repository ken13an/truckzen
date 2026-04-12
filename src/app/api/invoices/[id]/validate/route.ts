import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { validateInvoiceBeforeClose } from '@/lib/security'
import { safeRoute } from '@/lib/api-handler'

type P = { params: Promise<{ id: string }> }

async function _GET(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await validateInvoiceBeforeClose(id, user.shop_id)
  return NextResponse.json(result)
}

export const GET = safeRoute(_GET)
