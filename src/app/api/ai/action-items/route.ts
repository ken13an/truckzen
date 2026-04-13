/**
 * TruckZen — Original Design
 * AI action items — splits complaint into job lines with usage tracking
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAIUsage, checkAILimit } from '@/lib/ai-usage'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

/**
 * Last-resort split when AI is unavailable/errored and the user did not use
 * any delimiters. Splits on strong delimiters first; if none, splits before
 * each action verb that is NOT the very first token. Preserves the raw blob
 * as a single item only when no split is safe.
 */
function fallbackSplit(raw: string): { description: string; skills: never[] }[] {
  const text = raw.trim()
  if (!text) return [{ description: '', skills: [] }]

  // 1. Strong delimiters (newline / + / ; / ,)
  const strong = text.split(/\s*[,+;\n]\s*/).map(s => s.trim()).filter(s => s.length > 1)
  if (strong.length >= 2) return strong.map(s => ({ description: s.toUpperCase(), skills: [] }))

  // 2. Split before each action verb (not the first token). Known service-phrase
  //    preambles like "oil change" / "tire replacement" are also treated as
  //    boundaries when they appear mid-blob.
  const actionVerbs = new Set(['replace', 'install', 'change', 'repair', 'fix', 'add', 'remove', 'check', 'inspect', 'service', 'perform', 'do'])
  const servicePhrases: RegExp[] = [/\boil change\b/gi, /\btire replacement\b/gi, /\bpm service\b/gi, /\bpreventive maintenance\b/gi, /\bpreventative maintenance\b/gi]

  // Mark boundary positions
  const tokens = text.split(/\s+/)
  const cutIndices: number[] = []
  for (let i = 1; i < tokens.length; i++) {
    if (actionVerbs.has(tokens[i].toLowerCase())) cutIndices.push(i)
  }
  // Service-phrase mid-blob boundaries (by token index of first word of the phrase)
  const lowerTokens = tokens.map(t => t.toLowerCase())
  for (let i = 1; i < tokens.length - 1; i++) {
    const two = `${lowerTokens[i]} ${lowerTokens[i + 1]}`
    if (two === 'oil change' || two === 'tire replacement' || two === 'pm service' || two === 'preventive maintenance' || two === 'preventative maintenance') {
      if (!cutIndices.includes(i)) cutIndices.push(i)
    }
  }
  cutIndices.sort((a, b) => a - b)

  if (cutIndices.length === 0) return [{ description: text.toUpperCase(), skills: [] }]

  const segments: string[] = []
  let start = 0
  for (const cut of cutIndices) {
    const seg = tokens.slice(start, cut).join(' ').trim()
    if (seg) segments.push(seg)
    start = cut
  }
  const last = tokens.slice(start).join(' ').trim()
  if (last) segments.push(last)

  return segments.map(s => ({ description: s.toUpperCase(), skills: [] }))
}

const SKILLS = 'Engine Repair, Brake Service, Electrical/Diagnostics, Transmission, Suspension, HVAC/AC, Tire Service, Body/Frame, Trailer Repair, Welding, DOT Inspection, Preventive Maintenance, Diesel Fuel Systems, Exhaust/Aftertreatment, Hydraulics'

const SYSTEM_PROMPT = `You are a professional semi truck repair service writer. Take the rough customer complaint and break it into separate professional action items. For each action item, identify which mechanic skills are needed from: ${SKILLS}. Each description should be clear, concise, and in uppercase.

CRITICAL RULES — DO NOT MERGE DISTINCT CONCERNS:
1. Every distinct concern the user mentions MUST become its own action item. If the user mentions oil change AND tire replacement AND hose replacement AND spare tire, return FOUR items — never one combined item.
2. Only merge EXACT duplicates (e.g. the same service name literally repeated).
3. PM SERVICE HIERARCHY: ONLY if the user wrote "PM SERVICE" alongside a sub-item (oil change, filter, etc.) AND the user did NOT also list separate unrelated work — collapse those sub-items into "PM SERVICE". Do NOT collapse unrelated services (tire, hose, body, etc.).
4. TIRE JOBS: Keep distinct tire concerns as distinct items. "Replace tire" and "Replace spare tire" are TWO separate items. Do not auto-merge tire work unless the user used an explicit catch-all like "all tires".
5. Keep description exactly as intended — do NOT auto-upgrade "oil change" to "PM Service" unless user explicitly wrote "PM Service".

Return JSON only: {"action_items": [{"description": "OIL CHANGE", "skills": ["Preventive Maintenance"]}, {"description": "REPLACE TIRE", "skills": ["Tire Service"]}]}`

export async function POST(req: Request) {
  const { complaint, shop_id, user_id } = await req.json()
  if (!complaint?.trim()) return NextResponse.json({ error: 'complaint required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ action_items: fallbackSplit(complaint) })
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
      return NextResponse.json({ action_items: fallbackSplit(complaint) })
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

    return NextResponse.json({ action_items: fallbackSplit(complaint) })
  } catch (err: any) {
    if (shop_id) {
      const s = db()
      await logAIUsage(s, { shopId: shop_id, userId: user_id, feature: 'wo_creation', tokensIn: 0, tokensOut: 0, durationMs: Date.now() - startTime, success: false, errorMessage: err.message })
    }
    return NextResponse.json({ action_items: fallbackSplit(complaint) })
  }
}
