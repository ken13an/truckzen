import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { generatePaymentQR } from '@/lib/payments/qr'
import { log } from '@/lib/security'
import { safeRoute } from '@/lib/api-handler'

type P = { params: Promise<{ id: string }> }

async function _GET(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','accountant','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  try {
    const result = await generatePaymentQR(id)
    await log('invoice.qr_generated' as any, user.shop_id, user.id, { table:'invoices', recordId:id })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export const GET = safeRoute(_GET)
