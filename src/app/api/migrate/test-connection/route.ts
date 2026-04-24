import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/route-guards'
import { fullbayConnector } from '@/lib/services/connectors/fullbay'

const CONNECTORS: Record<string, typeof fullbayConnector> = {
  fullbay: fullbayConnector,
}

// POST /api/migrate/test-connection — proxy a credential test to an external
// connector (e.g. Fullbay). Platform-owner only: without this gate, any
// authenticated user could use TruckZen as a credential-stuffing proxy.
export async function POST(req: Request) {
  const { error: authError } = await requirePlatformOwner()
  if (authError) return authError

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
