/**
 * TruckZen — Original Design
 * AI action items — splits complaint into job lines with usage tracking
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAIUsage, checkAILimit } from '@/lib/ai-usage'
import { rateLimit } from '@/lib/ratelimit/core'
import { getRequestIp } from '@/lib/ratelimit/request-ip'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

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
  // Route has no auth guard — key burst cap by user_id when supplied, else IP.
  const { complaint, shop_id, user_id } = await req.json()
  if (!complaint?.trim()) return NextResponse.json({ error: 'complaint required' }, { status: 400 })

  const burstKey = typeof user_id === 'string' && user_id ? user_id : getRequestIp(req)
  const burstLimit = await rateLimit('ai-user', burstKey)
  if (!burstLimit.allowed) return NextResponse.json({ error: 'Too many AI requests' }, { status: 429 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
  }

  // Check AI limit if shop_id provided
  if (shop_id) {
    const s = db()
    const limitCheck = await checkAILimit(s, shop_id)
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
      if (shop_id) {
        const s = db()
        await logAIUsage(s, { shopId: shop_id, userId: user_id, feature: 'wo_creation', tokensIn: 0, tokensOut: 0, durationMs: Date.now() - startTime, success: false, errorMessage: `HTTP ${res.status}` })
      }
      return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const tokensIn = data.usage?.input_tokens || 0
    const tokensOut = data.usage?.output_tokens || 0

    // Log usage
    if (shop_id) {
      const s = db()
      await logAIUsage(s, { shopId: shop_id, userId: user_id, feature: 'wo_creation', tokensIn, tokensOut, model: 'claude-sonnet-4', durationMs: Date.now() - startTime })
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
    if (shop_id) {
      const s = db()
      await logAIUsage(s, { shopId: shop_id, userId: user_id, feature: 'wo_creation', tokensIn: 0, tokensOut: 0, durationMs: Date.now() - startTime, success: false, errorMessage: err.message })
    }
    return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
  }
}
