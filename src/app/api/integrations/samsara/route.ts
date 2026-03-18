// app/api/integrations/samsara/route.ts
// Receives GPS events from Samsara webhook
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  // Verify Samsara webhook signature
  const sig = req.headers.get('x-samsara-hmac-sha256')
  // TODO: implement HMAC verification with SAMSARA_WEBHOOK_SECRET

  const body = await req.json()
  const { eventType, data } = body

  switch (eventType) {
    case 'VehicleLocation': {
      // Update asset odometer/location
      const { vehicleId, odometer, location } = data
      await supabase
        .from('assets')
        .update({
          odometer:   odometer ? Math.round(odometer / 1609.344) : undefined, // meters to miles
          last_lat:   location?.latitude,
          last_lng:   location?.longitude,
          last_gps_update: new Date().toISOString(),
        })
        .eq('samsara_vehicle_id', vehicleId)
      break
    }

    case 'EngineFaultCode': {
      // Fault code detected — create draft SO if not already open
      const { vehicleId, dtcCode, dtcDescription } = data
      const { data: asset } = await supabase
        .from('assets')
        .select('id, shop_id, unit_number')
        .eq('samsara_vehicle_id', vehicleId)
        .single()

      if (asset) {
        // Check for existing open SO
        const { data: openSO } = await supabase
          .from('service_orders')
          .select('id')
          .eq('asset_id', asset.id)
          .not('status', 'in', '("good_to_go","void")')
          .limit(1)
          .single()

        if (!openSO) {
          const { count } = await supabase.from('service_orders').select('*', { count:'exact', head:true }).eq('shop_id', asset.shop_id)
          const soNum = `SO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
          await supabase.from('service_orders').insert({
            shop_id:   asset.shop_id,
            asset_id:  asset.id,
            so_number: soNum,
            complaint: `GPS fault code detected: ${dtcCode} — ${dtcDescription}`,
            source:    'gps_auto',
            priority:  'high',
            status:    'not_started',
          })
        }
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
