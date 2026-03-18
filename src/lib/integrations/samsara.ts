// lib/integrations/samsara.ts
const BASE    = 'https://api.samsara.com'
const API_KEY = process.env.SAMSARA_API_KEY

async function samsaraFetch(path: string) {
  if (!API_KEY) { console.warn('SAMSARA_API_KEY not set'); return null }
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Token ${API_KEY}` },
    next: { revalidate: 300 },
  })
  if (!res.ok) return null
  return res.json()
}

export interface VehicleLocation {
  vehicle_id: string
  unit_number: string
  odometer_miles: number
  latitude: number
  longitude: number
  speed_mph: number
  heading: number
  updated_at: string
}

export async function getVehicleLocations(): Promise<VehicleLocation[]> {
  const data = await samsaraFetch('/fleet/vehicles/stats?types=gpsOdometerMeters,gps')
  if (!data?.data) return []
  return data.data.map((v: any) => ({
    vehicle_id:    v.id,
    unit_number:   v.name,
    odometer_miles:Math.round((v.gpsOdometerMeters?.value || 0) / 1609.344),
    latitude:      v.gps?.latitude  || 0,
    longitude:     v.gps?.longitude || 0,
    speed_mph:     Math.round((v.gps?.speedMilesPerHour || 0)),
    heading:       v.gps?.headingDegrees || 0,
    updated_at:    v.gps?.time || new Date().toISOString(),
  }))
}

export async function getVehicleFaultCodes(vehicleId: string) {
  const data = await samsaraFetch(`/fleet/vehicles/stats?ids=${vehicleId}&types=obdEngineSeconds`)
  return data?.data?.[0] || null
}

export async function syncOdometerToSupabase(supabase: any, shopId: string) {
  const locations = await getVehicleLocations()
  if (!locations.length) return { synced: 0 }

  let synced = 0
  for (const loc of locations) {
    const { error } = await supabase
      .from('assets')
      .update({
        odometer:        loc.odometer_miles,
        last_lat:        loc.latitude,
        last_lng:        loc.longitude,
        last_gps_update: loc.updated_at,
      })
      .eq('shop_id', shopId)
      .eq('unit_number', loc.unit_number)

    if (!error) synced++
  }
  return { synced, total: locations.length }
}
