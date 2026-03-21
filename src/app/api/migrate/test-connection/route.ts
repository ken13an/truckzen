import { NextResponse } from 'next/server'
import { fullbayConnector } from '@/lib/services/connectors/fullbay'

const CONNECTORS: Record<string, typeof fullbayConnector> = {
  fullbay: fullbayConnector,
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { source, api_key } = body

    if (!source || !api_key) {
      return NextResponse.json({ error: 'source and api_key are required' }, { status: 400 })
    }

    const connector = CONNECTORS[source]
    if (!connector) {
      return NextResponse.json({
        error: `Unknown source: ${source}. Supported: ${Object.keys(CONNECTORS).join(', ')}`,
      }, { status: 400 })
    }

    const result = await connector.testConnection(api_key)
    return NextResponse.json(result, { status: result.ok ? 200 : 422 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Connection test failed' }, { status: 500 })
  }
}
