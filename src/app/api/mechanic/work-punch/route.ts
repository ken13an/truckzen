/**
 * Workplace attendance punch in/out — session-authenticated.
 * GET = current active punch status (from session)
 * POST = punch in or punch out (from session)
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { ASSIGNMENT_ROLES } from '@/lib/roles'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET() {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = db()
  const { data: active } = await s.from('work_punches')
    .select('id, punch_in_at, geo_lat, geo_lng, inside_geofence')
    .eq('user_id', actor.id)
    .is('punch_out_at', null)
    .order('punch_in_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ punchedIn: !!active, activePunch: active || null })
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = db()
  const { action, lat, lng, accuracy, override_reason, client_event_id } = await req.json()
  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (action === 'punch_in') {
    if (!client_event_id || typeof client_event_id !== 'string' || !UUID_RE.test(client_event_id)) {
      return NextResponse.json({ error: 'client_event_id required' }, { status: 400 })
    }
    // Idempotent replay: same (user_id, client_event_id) → return existing row.
    const { data: prior } = await s.from('work_punches')
      .select('id, punch_in_at, punch_out_at, inside_geofence')
      .eq('user_id', actor.id)
      .eq('client_event_id', client_event_id)
      .limit(1).maybeSingle()
    if (prior) {
      return NextResponse.json({ ok: true, deduped: true, punch: { id: prior.id, punch_in_at: prior.punch_in_at }, insideGeofence: prior.inside_geofence })
    }
  }

  // Geofence from real shop record
  const { data: shop } = await s.from('shops').select('geofence_lat, geofence_lng, geofence_radius_meters').eq('id', shopId).single()
  const fenceLat = shop?.geofence_lat
  const fenceLng = shop?.geofence_lng
  const fenceRadius = shop?.geofence_radius_meters || 100

  const geofenceConfigured = !!(fenceLat && fenceLng)
  const locationProvided = !!(lat && lng)

  let insideGeofence = true
  if (geofenceConfigured && locationProvided) {
    insideGeofence = haversineMeters(lat, lng, fenceLat, fenceLng) <= fenceRadius
  } else if (geofenceConfigured && !locationProvided) {
    insideGeofence = false
  }

  if (action === 'punch_in') {
    const { data: existing } = await s.from('work_punches')
      .select('id').eq('user_id', actor.id).is('punch_out_at', null).limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Already punched in', activePunchId: existing[0].id }, { status: 409 })
    }

    if (!insideGeofence) {
      const effectiveRole = actor.impersonate_role || actor.role || ''
      const canSelfOverride = ASSIGNMENT_ROLES.includes(effectiveRole)

      if (!canSelfOverride) {
        const msg = !locationProvided
          ? 'Location is required to punch in. Please enable GPS and try again.'
          : 'You must be at the shop to punch in. Contact your supervisor if you need assistance.'
        return NextResponse.json({ error: msg, outsideGeofence: true, blocked: true }, { status: 403 })
      }

      if (!override_reason || override_reason.trim().length < 10) {
        return NextResponse.json({ error: 'Override reason must be at least 10 characters.', outsideGeofence: true }, { status: 403 })
      }
    }

    const { data: punch, error } = await s.from('work_punches').insert({
      user_id: actor.id, shop_id: shopId,
      punch_in_at: new Date().toISOString(),
      geo_lat: lat || null, geo_lng: lng || null, geo_accuracy: accuracy || null,
      inside_geofence: insideGeofence,
      override_flag: !insideGeofence,
      override_reason: override_reason || null,
      client_event_id,
    }).select('id, punch_in_at').single()

    if (error) {
      // Unique violation on (user_id, client_event_id) → racing replay; resolve to existing row.
      if ((error as any).code === '23505') {
        const { data: existing } = await s.from('work_punches')
          .select('id, punch_in_at, inside_geofence')
          .eq('user_id', actor.id)
          .eq('client_event_id', client_event_id)
          .limit(1).maybeSingle()
        if (existing) {
          return NextResponse.json({ ok: true, deduped: true, punch: { id: existing.id, punch_in_at: existing.punch_in_at }, insideGeofence: existing.inside_geofence })
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, punch, insideGeofence })
  }

  if (action === 'punch_out') {
    const { data: active } = await s.from('work_punches')
      .select('id, punch_in_at')
      .eq('user_id', actor.id)
      .is('punch_out_at', null)
      .order('punch_in_at', { ascending: false })
      .limit(1).single()

    if (!active) return NextResponse.json({ error: 'Not punched in' }, { status: 400 })

    const now = new Date()
    const durationMinutes = Math.round((now.getTime() - new Date(active.punch_in_at).getTime()) / 60000)

    await s.from('work_punches').update({ punch_out_at: now.toISOString(), duration_minutes: durationMinutes }).eq('id', active.id)

    // Auto-clock-out any active job timer
    const { data: activeJobClock } = await s.from('so_time_entries')
      .select('id, clocked_in_at')
      .eq('user_id', actor.id)
      .is('clocked_out_at', null)
      .limit(1).single()

    if (activeJobClock) {
      const jobDuration = Math.round((now.getTime() - new Date(activeJobClock.clocked_in_at).getTime()) / 60000)
      await s.from('so_time_entries').update({ clocked_out_at: now.toISOString(), duration_minutes: jobDuration }).eq('id', activeJobClock.id)
    }

    return NextResponse.json({ ok: true, durationMinutes, insideGeofence, jobClockStopped: !!activeJobClock })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
