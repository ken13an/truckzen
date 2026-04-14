import { NextResponse } from 'next/server'
import { getAuthenticatedUserProfile, getActorShopId } from '@/lib/server-auth'
import { generatePaymentQR } from '@/lib/payments/qr'
import { log } from '@/lib/security'
import { safeRoute } from '@/lib/api-handler'

type P = { params: Promise<{ id: string }> }

async function _GET(_req: Request, { params }: P) {
  const { id } = await params;
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const allowed = ['owner','gm','it_person','shop_manager','accountant','office_admin']
  const effectiveRole = actor.impersonate_role || actor.role
  if (!allowed.includes(effectiveRole)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  try {
    const result = await generatePaymentQR(id)
    await log('invoice.qr_generated' as any, shopId, actor.id, { table:'invoices', recordId:id })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export const GET = safeRoute(_GET)
