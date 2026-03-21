import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

const PROMPTS: Record<string, string> = {
  kiosk: `You are a professional truck service writer at a heavy-duty repair shop. A customer/driver is describing their truck problem at a check-in kiosk. They may type in any language. Generate a clean, professional concern description in English. If the input is not English, also provide the concern in the original language. Return ONLY valid JSON: {"concern": "...", "concern_native": null or "..."}`,

  service_writer: `You are a professional heavy truck service writer. A service writer is creating a work order and typing notes about a customer's concern. Clean up the text into a professional, technically accurate concern description using proper trucking terminology. If input is not English, translate to English and keep the original. Return ONLY valid JSON: {"concern": "...", "concern_native": null or "..."}`,

  mechanic: `You are an expert heavy truck diagnostic technician. A mechanic is describing what they found wrong and what needs to be fixed. They may type in any language. Generate:
1. Professional cause statement (what failed and why)
2. Professional correction procedure (step by step repair)
3. Parts likely needed (specific part names)
4. Estimated labor hours (range)
Use proper trucking terminology (Cummins, Detroit, PACCAR, Allison, Eaton Fuller, etc.). If input is not English, also provide cause and correction in the original language. Return ONLY valid JSON:
{"cause": "...", "correction": "...", "parts": ["..."], "labor_hours": 0.0, "cause_native": null or "...", "correction_native": null or "..."}`,

  supervisor: `You are a professional truck shop floor supervisor. Format the following note into a clear, professional update for the work order record. If input is not English, translate to English and keep original. Return ONLY valid JSON: {"note": "...", "note_native": null or "..."}`,
}

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>()

export async function POST(req: Request) {
  const body = await req.json()
  const { text, context = 'service_writer', language = 'en', truck_info, shop_id, user_id } = body

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Text too long (max 2000 characters)' }, { status: 400 })
  }

  // Basic prompt injection check
  const lower = text.toLowerCase()
  if (lower.includes('ignore previous') || lower.includes('system prompt') || lower.includes('you are now')) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Rate limit: 30 calls per user per minute
  const rateLimitKey = user_id || req.headers.get('x-forwarded-for') || 'anonymous'
  const now = Date.now()
  const limit = rateLimits.get(rateLimitKey)
  if (limit && limit.resetAt > now && limit.count >= 30) {
    return NextResponse.json({ error: 'Too many AI requests. Please wait a minute.' }, { status: 429 })
  }
  if (!limit || limit.resetAt <= now) {
    rateLimits.set(rateLimitKey, { count: 1, resetAt: now + 60000 })
  } else {
    limit.count++
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const systemPrompt = PROMPTS[context] || PROMPTS.service_writer
  let userMessage = text.trim()
  if (truck_info) {
    userMessage += `\n\nTruck info: ${truck_info.year || ''} ${truck_info.make || ''} ${truck_info.model || ''} ${truck_info.engine ? '(' + truck_info.engine + ')' : ''}`.trim()
  }
  if (language !== 'en') {
    userMessage += `\n\nNote: Input language is ${language}. Provide native language translations.`
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      console.error('[AI Service Writer] API error:', res.status)
      return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 502 })
    }

    const data = await res.json()
    const rawText = data.content?.[0]?.text || ''

    // Parse JSON from response (strip markdown fences if present)
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI response could not be parsed', raw: rawText }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])
    const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)

    // Log usage (fire and forget)
    if (shop_id || user_id) {
      const s = db()
      s.from('ai_usage_log').insert({
        shop_id: shop_id || null,
        user_id: user_id || null,
        feature: `service_writer_${context}`,
        model: 'claude-sonnet-4-20250514',
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
        estimated_cost: tokens * 0.000003,
        input_language: language,
        success: true,
      }).then(() => {})
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[AI Service Writer] Error:', err)
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}
