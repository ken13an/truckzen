import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/route-guards'
import { fetchPreview } from '@/lib/fullbay/client'

// GET /api/fullbay/preview/[type] — preview rows from the shared single-tenant
// Fullbay connection. Platform-owner only: the response can contain customer
// PII pulled from the external provider.
export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { error: authError } = await requirePlatformOwner()
  if (authError) return authError

  const { type } = await params
  if (!process.env.FULLBAY_API_KEY) {
    return NextResponse.json({ error: 'FULLBAY_API_KEY not configured' }, { status: 500 })
  }
  if (!['customers', 'trucks', 'parts', 'invoices'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  try {
    const mapped = await fetchPreview(type)
    return NextResponse.json({ mapped, count: mapped.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
