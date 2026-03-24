// In-memory rate limiter for kiosk check-ins
// 10 check-ins per hour per IP
const kioskAttempts = new Map<string, { count: number; resetAt: number }>()

export function checkKioskLimit(ip: string): boolean {
  const now = Date.now()
  const record = kioskAttempts.get(ip)

  if (!record || now > record.resetAt) {
    kioskAttempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }

  if (record.count >= 10) return false

  record.count++
  return true
}
