import { NextResponse } from 'next/server'
import { getAuthenticatedUserProfile, getActorShopId } from '@/lib/server-auth'
import { validateInvoiceBeforeClose } from '@/lib/security'
import { safeRoute } from '@/lib/api-handler'

type P = { params: Promise<{ id: string }> }

async function _GET(_req: Request, { params }: P) {
  const { id } = await params;
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const result = await validateInvoiceBeforeClose(id, shopId)
  return NextResponse.json(result)
}

export const GET = safeRoute(_GET)
