/**
 * TruckZen — Original Design
 * AI action items — splits complaint into job lines with usage tracking
 *
 * Dual-auth model:
 *   Mode A — authenticated browser caller (e.g. /work-orders/new):
 *     getAuthenticatedUserProfile() succeeds; shop_id/user_id are derived
 *     from the session and any body shop_id/user_id are ignored.
 *   Mode B — signed internal server caller (only /api/kiosk-checkin today):
 *     no session cookie. The route verifies a HMAC signature over the raw
 *     body before accepting body shop_id/user_id for limit/log scoping.
 *   Anything else → 401.
 */
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile } from '@/lib/server-auth'
import { logAIUsage, checkAILimit } from '@/lib/ai-usage'
import { rateLimit } from '@/lib/ratelimit/core'
import {
  INTERNAL_TS_HEADER,
  INTERNAL_SIG_HEADER,
  verifyInternalRequest,
} from '@/lib/internal-request-auth'

const SKILLS = 'Engine Repair, Brake Service, Electrical/Diagnostics, Transmission, Suspension, HVAC/AC, Tire Service, Body/Frame, Trailer Repair, Welding, DOT Inspection, Preventive Maintenance, Diesel Fuel Systems, Exhaust/Aftertreatment, Hydraulics'

const SYSTEM_PROMPT = `You are a professional semi truck repair service writer. Take the rough customer complaint and break it into separate professional action items. For each action item, identify which mechanic skills are needed from: ${SKILLS}. Each description should be clear, concise, and in uppercase.

CRITICAL RULES:
1. MERGE DUPLICATES: If the same service is listed multiple times, merge into ONE job line.
2. PM SERVICE HIERARCHY: PM Service includes: oil change, oil filter, air filter, fuel filter, coolant check, belt inspection, tire inspection, brake inspection, DEF fluid, grease. If user lists "PM SERVICE" plus any individually, merge into just "PM SERVICE".
3. OIL CHANGE: If listed multiple times, merge into one. If "oil change" + "PM Service" → just "PM SERVICE".
4. TIRE JOBS: Keep separate ONLY if different positions specified. Otherwise merge.
5. Keep description exactly as intended — do NOT auto-upgrade "oil change" to "PM Service" unless user wrote both.

Return JSON only: {"action_items": [{"description": "BRAKE SYSTEM INSPECTION", "skills": ["Brake Service"]}]}`

export async function POST(req: Request) {
  // Read raw body once so internal-mode signature verification can hash
  // exactly the bytes the caller signed. We then JSON.parse the same string.
  const rawBody = await req.text()

  let body: any
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Mode A — authenticated browser. Session truth wins; body shop_id/user_id
  // are ignored.
  const actor = await getAuthenticatedUserProfile()
  let shopId: string | null = null
  let userId: string | null = null

  if (actor) {
    shopId = (actor as any).effective_shop_id || (actor as any).shop_id || null
    userId = actor.id
  } else {
    // Mode B — signed internal caller (kiosk-checkin server-to-server).
    const ts  = req.headers.get(INTERNAL_TS_HEADER)
    const sig = req.headers.get(INTERNAL_SIG_HEADER)
    const ok = verifyInternalRequest({
      method: 'POST',
      pathname: new URL(req.url).pathname,
      rawBody,
      timestamp: ts,
      signature: sig,
    })
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // After signature verification, body shop_id/user_id is trusted (it
    // came from a server-side caller that holds TRUCKZEN_INTERNAL_API_SECRET).
    shopId = typeof body.shop_id === 'string' ? body.shop_id : null
    userId = typeof body.user_id === 'string' ? body.user_id : null
  }

  const complaint = typeof body.complaint === 'string' ? body.complaint : ''
  if (!complaint?.trim()) return NextResponse.json({ error: 'complaint required' }, { status: 400 })

  // Rate limit by best stable key for this mode
  const burstKey = userId || shopId || 'internal:anon'
  const burstLimit = await rateLimit('ai-user', burstKey)
  if (!burstLimit.allowed) return NextResponse.json({ error: 'Too many AI requests' }, { status: 429 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
  }

  // Check AI limit if shopId resolved
  if (shopId) {
    const s = createAdminSupabaseClient()
    const limitCheck = await checkAILimit(s, shopId)
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: 'AI monthly limit reached', usage: limitCheck.usage, limit: limitCheck.limit }, { status: 429 })
    }
  }

  const startTime = Date.now()

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: complaint.trim() }],
      }),
    })

    if (!res.ok) {
      if (shopId) {
        const s = createAdminSupabaseClient()
        await logAIUsage(s, { shopId, userId: userId || undefined, feature: 'wo_creation', tokensIn: 0, tokensOut: 0, durationMs: Date.now() - startTime, success: false, errorMessage: `HTTP ${res.status}` })
      }
      return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const tokensIn = data.usage?.input_tokens || 0
    const tokensOut = data.usage?.output_tokens || 0

    // Log usage
    if (shopId) {
      const s = createAdminSupabaseClient()
      await logAIUsage(s, { shopId, userId: userId || undefined, feature: 'wo_creation', tokensIn, tokensOut, model: 'claude-sonnet-4', durationMs: Date.now() - startTime })
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed.action_items) && parsed.action_items.length > 0) {
        const items = parsed.action_items.map((item: any) => {
          if (typeof item === 'string') return { description: item, skills: [] }
          return { description: item.description || item, skills: Array.isArray(item.skills) ? item.skills : [] }
        })
        return NextResponse.json({ action_items: items })
      }
    }

    return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
  } catch (err: any) {
    if (shopId) {
      const s = createAdminSupabaseClient()
      await logAIUsage(s, { shopId, userId: userId || undefined, feature: 'wo_creation', tokensIn: 0, tokensOut: 0, durationMs: Date.now() - startTime, success: false, errorMessage: err.message })
    }
    return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
  }
}
