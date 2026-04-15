// Canonical shared rate-limit core.
//
// Backend: Upstash Redis (sliding window, durable + global across Vercel
// lambdas). Named policies keyed by `type`; callers pass `(type, key)` only,
// never raw thresholds, so endpoint code cannot drift limits.
//
// Failure modes:
//   - production + env missing  → fail-closed ({allowed:false, configured:false}) + loud log
//   - non-production + env missing → dev fallback allows with one warn log
//   - env present → real limiter
//
// Do NOT introduce per-route numeric thresholds here. Register a new named
// policy in POLICIES first if a different shape is needed.
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  configured: boolean
}

type Policy = { limit: number; window: Parameters<typeof Ratelimit.slidingWindow>[1] }

// Named policies. `api` is the default used by existing call sites that pass
// `'api'` as the type. Add entries here when new named policies are needed;
// callers must not invent inline thresholds.
const POLICIES: Record<string, Policy> = {
  api: { limit: 60, window: '1 m' },
  strict: { limit: 10, window: '1 m' },
  // Blanket per-IP floor for all /api/* traffic (Patch 21). Generous enough
  // not to block normal app usage; tight enough to stop volumetric floods.
  'api-floor': { limit: 600, window: '1 m' },
  // Auth / public brute-force hardening (Patch 22).
  'login-ip':            { limit: 20, window: '15 m' },
  '2fa-validate-ip':     { limit: 5,  window: '15 m' },
  '2fa-validate-user':   { limit: 5,  window: '15 m' },
  'accept-invite-ip':    { limit: 10, window: '1 h' },
  'accept-invite-token': { limit: 5,  window: '1 h' },
}

function requiredEnvPresent(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN
}

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  return _redis
}

const limiters = new Map<string, Ratelimit>()
function getLimiter(type: string): Ratelimit {
  let l = limiters.get(type)
  if (l) return l
  const policy = POLICIES[type] ?? POLICIES.api
  l = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    prefix: `tz:rl:${type}`,
    analytics: false,
  })
  limiters.set(type, l)
  return l
}

let devWarned = false

export async function rateLimit(type: string, key: string): Promise<RateLimitResult> {
  if (!requiredEnvPresent()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN missing in production — failing closed')
      return { allowed: false, remaining: 0, configured: false }
    }
    if (!devWarned) {
      devWarned = true
      console.warn('[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN missing in dev — fail-open. Do NOT deploy without env.')
    }
    return { allowed: true, remaining: -1, configured: false }
  }
  const { success, remaining } = await getLimiter(type).limit(key)
  return { allowed: success, remaining, configured: true }
}
