import { createHash, createHmac, timingSafeEqual } from 'crypto'

// Internal server-to-server request signing for trusted in-process callers
// (e.g. /api/kiosk-checkin → /api/ai/action-items). Browsers must NEVER hold
// this secret. The route on the receiving side verifies the HMAC before
// trusting any body field.
//
// Canonical signature input:
//   <METHOD_UPPERCASE>\n<pathname>\n<timestamp_ms>\n<sha256(rawBody)>

export const INTERNAL_TS_HEADER  = 'x-truckzen-internal-ts'
export const INTERNAL_SIG_HEADER = 'x-truckzen-internal-signature'

const TS_TOLERANCE_MS = 5 * 60 * 1000

function getSecret(): string {
  const s = process.env.TRUCKZEN_INTERNAL_API_SECRET
  if (!s) throw new Error('TRUCKZEN_INTERNAL_API_SECRET not configured')
  return s
}

function bodyHash(rawBody: string): string {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex')
}

function payload(method: string, pathname: string, timestamp: string, rawBody: string): string {
  return `${method.toUpperCase()}\n${pathname}\n${timestamp}\n${bodyHash(rawBody)}`
}

export function signInternalRequest(input: { method: string; pathname: string; rawBody: string }): {
  timestamp: string
  signature: string
} {
  const timestamp = String(Date.now())
  const signature = createHmac('sha256', getSecret())
    .update(payload(input.method, input.pathname, timestamp, input.rawBody))
    .digest('hex')
  return { timestamp, signature }
}

export function verifyInternalRequest(input: {
  method: string
  pathname: string
  rawBody: string
  timestamp: string | null | undefined
  signature: string | null | undefined
}): boolean {
  if (!input.timestamp || !input.signature) return false
  const ts = Number(input.timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() - ts) > TS_TOLERANCE_MS) return false

  let expectedHex: string
  try {
    expectedHex = createHmac('sha256', getSecret())
      .update(payload(input.method, input.pathname, input.timestamp, input.rawBody))
      .digest('hex')
  } catch {
    return false
  }

  const expected = Buffer.from(expectedHex, 'hex')
  let actual: Buffer
  try {
    actual = Buffer.from(input.signature, 'hex')
  } catch {
    return false
  }
  if (actual.length !== expected.length) return false
  try {
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
