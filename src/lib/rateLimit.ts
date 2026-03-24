const requestCounts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, limit = 100, windowMs = 60000): boolean {
  const now = Date.now()
  const record = requestCounts.get(key)

  if (!record || now > record.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= limit) return false

  record.count++
  return true
}
