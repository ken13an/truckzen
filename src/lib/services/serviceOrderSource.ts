// Canonical helper for customer/service-writer intake service_orders.source
// values. Values are derived from current proven write paths:
//   'kiosk'          — /api/kiosk-checkin direct service_orders insert
//   'service_writer' — /api/service-requests convert (SR created via service-writer)
//   'kiosk_checkin'  — /api/service-requests convert (SR created via /api/kiosk)

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
