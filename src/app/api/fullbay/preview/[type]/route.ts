import { NextResponse } from 'next/server'
import { fetchPreview, mapCustomer, mapTruck, mapPart } from '@/lib/fullbay/client'

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!process.env.FULLBAY_API_KEY) {
    return NextResponse.json({ error: 'FULLBAY_API_KEY not configured' }, { status: 500 })
  }
  if (!['customers', 'trucks', 'parts'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  try {
    const raw = await fetchPreview(type as any)
    const mapper = type === 'customers' ? mapCustomer : type === 'trucks' ? mapTruck : mapPart
    const mapped = raw.map(mapper)
    return NextResponse.json({ raw: raw.slice(0, 3), mapped, count: mapped.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
