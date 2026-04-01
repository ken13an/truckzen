// app/api/integrations/samsara/route.ts
// Receives GPS/fault events from Samsara webhook
// Asset resolution uses asset_external_links (provider='samsara') as PRIMARY path
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// --- HMAC Signature Verification ---
// Samsara sends HMAC-SHA256 signature in x-samsara-hmac-sha256 header
// Secret is set in SAMSARA_WEBHOOK_SECRET env variable
function verifyHmac(rawBody: string, signature: string | null): boolean {
  const secret = process.env.SAMSARA_WEBHOOK_SECRET
  if (!secret) {
    // If no secret configured, reject all requests — do not silently accept
    console.error('[Samsara] SAMSARA_WEBHOOK_SECRET not configured — rejecting request')
    return false
  }
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

// --- Asset Resolution ---
// PRIMARY: Look up via asset_external_links where provider='samsara'
// FALLBACK: None — asset_external_links is the only path
async function resolveAssetBySamsaraId(supabase: ReturnType<typeof db>, vehicleId: string) {
  const { data: link } = await supabase
    .from('asset_external_links')
    .select('asset_id')
    .eq('provider', 'samsara')
    .eq('external_id', String(vehicleId))
    .limit(1)
    .single()

  if (!link) return null

  const { data: asset } = await supabase
    .from('assets')
    .select('id, shop_id, unit_number')
    .eq('id', link.asset_id)
    .single()

  return asset || null
}

export async function POST(req: Request) {
  // Read raw body for HMAC verification before parsing
  const rawBody = await req.text()
  const sig = req.headers.get('x-samsara-hmac-sha256')

  if (!verifyHmac(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const { eventType, data } = body
  const supabase = db()

  switch (eventType) {
    case 'VehicleLocation': {
      const { vehicleId, odometer, location } = data
      const asset = await resolveAssetBySamsaraId(supabase, vehicleId)
      if (!asset) {
        console.warn(`[Samsara] VehicleLocation: no asset linked for samsara vehicle ${vehicleId}`)
        break
      }

      const updates: Record<string, unknown> = { last_gps_update: new Date().toISOString() }
      if (odometer) updates.odometer = Math.round(odometer / 1609.344) // meters to miles
      if (location?.latitude) updates.last_lat = location.latitude
      if (location?.longitude) updates.last_lng = location.longitude

      await supabase.from('assets').update(updates).eq('id', asset.id)
      break
    }

    case 'EngineFaultCode': {
      const { vehicleId, dtcCode, dtcDescription } = data
      const asset = await resolveAssetBySamsaraId(supabase, vehicleId)
      if (!asset) {
        console.warn(`[Samsara] EngineFaultCode: no asset linked for samsara vehicle ${vehicleId}`)
        break
      }

      // Check for existing open SO for this asset
      const { data: openSO } = await supabase
        .from('service_orders')
        .select('id')
        .eq('asset_id', asset.id)
        .is('deleted_at', null)
        .not('status', 'in', '("good_to_go","void")')
        .limit(1)
        .single()

      if (!openSO) {
        const { count } = await supabase
          .from('service_orders')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', asset.shop_id)

        const soNum = `SO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
        await supabase.from('service_orders').insert({
          shop_id: asset.shop_id,
          asset_id: asset.id,
          so_number: soNum,
          complaint: `GPS fault code detected: ${dtcCode} — ${dtcDescription}`,
          source: 'gps_auto',
          priority: 'high',
          status: 'not_started',
          workorder_lane: 'shop_internal',
          // status_family is derived by DB trigger — do not set manually
        })
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
