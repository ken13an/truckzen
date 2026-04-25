import { createHmac, timingSafeEqual, randomBytes } from 'crypto'

// Signed-state helpers for the QBO OAuth flow. The state value carried
// through QuickBooks's authorize → callback round-trip binds the connection
// to a specific actor + shop and proves the callback was initiated by us.
//
// Format: `<payload_b64url>.<signature_b64url>` where payload is JSON
// { shop_id, user_id, nonce, issued_at } and signature is HMAC-SHA256 of
// payload bytes using QBO_OAUTH_STATE_SECRET (server-only env var).

const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export interface QboStatePayload {
  shop_id: string
  user_id: string
  nonce: string
  issued_at: number
}

function getSecret(): string {
  const s = process.env.QBO_OAUTH_STATE_SECRET
  if (!s) throw new Error('QBO_OAUTH_STATE_SECRET not configured')
  return s
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function signQboState(input: { shop_id: string; user_id: string }): string {
  const payload: QboStatePayload = {
    shop_id: input.shop_id,
    user_id: input.user_id,
    nonce: b64url(randomBytes(16)),
    issued_at: Date.now(),
  }
  const payloadJson = JSON.stringify(payload)
  const payloadB64 = b64url(Buffer.from(payloadJson, 'utf8'))
  const sig = createHmac('sha256', getSecret()).update(payloadB64).digest()
  return `${payloadB64}.${b64url(sig)}`
}

export function verifyQboState(state: string | null | undefined): QboStatePayload | null {
  if (!state || typeof state !== 'string') return null
  const dot = state.indexOf('.')
  if (dot <= 0 || dot === state.length - 1) return null
  const payloadB64 = state.slice(0, dot)
  const sigB64 = state.slice(dot + 1)

  // Compute expected signature and compare in constant time
  let actualSig: Buffer
  let expectedSig: Buffer
  try {
    actualSig = fromB64url(sigB64)
    expectedSig = createHmac('sha256', getSecret()).update(payloadB64).digest()
  } catch {
    return null
  }
  if (actualSig.length !== expectedSig.length) return null
  if (!timingSafeEqual(actualSig, expectedSig)) return null

  // Decode payload after signature passes
  let payload: QboStatePayload
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString('utf8'))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.shop_id !== 'string' || typeof payload.user_id !== 'string') return null
  if (typeof payload.issued_at !== 'number') return null

  if (Date.now() - payload.issued_at > STATE_TTL_MS) return null
  return payload
}
