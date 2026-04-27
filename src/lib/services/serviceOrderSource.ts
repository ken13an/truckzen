// Canonical helpers for service-order source canonicalization.
//
// service_orders.source is a Postgres enum (so_source) with proven values:
//   'kiosk', 'walk_in', 'fullbay', 'gps_auto', 'migration'
//
// service_requests.source is a free string (no enum) and accepts intake-
// source labels like 'kiosk_checkin' and 'service_writer' that are NOT
// valid on the SO side. The Pending Request adapter maps the SR-side
// string onto a valid SO-side enum value (srSourceToSoSource below)
// before handing off to insertServiceOrder().
//
// INTAKE_SO_SOURCES below is a labeling/derivation set used by the staff
// WO list and detail page to flag intake-originated WOs and to label
// service-request rows; it is NOT the so_source enum allowlist.

export const INTAKE_SO_SOURCES = ['kiosk', 'service_writer', 'kiosk_checkin'] as const

export type IntakeSoSource = typeof INTAKE_SO_SOURCES[number]

export function isIntakeSoSource(source: unknown): source is IntakeSoSource {
  return typeof source === 'string' && (INTAKE_SO_SOURCES as readonly string[]).includes(source)
}

export function intakeSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case 'kiosk': return 'Kiosk Intake'
    case 'service_writer': return 'Service Request Intake'
    case 'kiosk_checkin': return 'Kiosk Service Request'
    default: return 'Customer Intake'
  }
}

// Map service_requests.source (free string) to a valid service_orders.source
// enum value. Kiosk-originated requests map to 'kiosk' (semantically the
// customer self-checking in via the kiosk); everything else falls through
// to 'walk_in' (the proven enum value used by /api/work-orders create +
// /api/work-orders/draft). The SR-side source string is never written
// directly to service_orders.source.
export function srSourceToSoSource(srSource: string | null | undefined): 'kiosk' | 'walk_in' {
  return srSource === 'kiosk_checkin' || srSource === 'kiosk' ? 'kiosk' : 'walk_in'
}
