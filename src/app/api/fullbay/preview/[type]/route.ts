import { NextResponse } from 'next/server'
import { fetchPreview } from '@/lib/fullbay/client'

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
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
