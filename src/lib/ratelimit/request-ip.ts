// Shared request-IP extractor for route handlers (plain Request).
// Matches the pattern already used in src/app/api/auth/login/route.ts and
// src/app/api/pay/* so every handler keys rate-limits off the same IP.
export function getRequestIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') || 'unknown'
}
