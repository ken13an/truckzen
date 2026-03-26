import { NextResponse } from 'next/server'
import { logAIUsage, checkAILimit } from '@/lib/ai-usage'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

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

const rateLimits = new Map<string, { count: number; resetAt: number }>()

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.shop_id) return jsonError('No shop context', 400)

  const body = await req.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text : ''
  const context = typeof body?.context === 'string' ? body.context : 'service_writer'
  const language = typeof body?.language === 'string' ? body.language : 'en'
  const truck_info = body?.truck_info

  if (!text.trim()) return jsonError('Text is required', 400)
  if (text.length > 2000) return jsonError('Text too long (max 2000 characters)', 400)

  const lower = text.toLowerCase()
  if (lower.includes('ignore previous') || lower.includes('system prompt') || lower.includes('you are now')) {
    return jsonError('Invalid input', 400)
  }

  const now = Date.now()
  const rateLimitKey = actor.id
  const limit = rateLimits.get(rateLimitKey)
  if (limit && limit.resetAt > now && limit.count >= 30) {
    return jsonError('Too many AI requests. Please wait a minute.', 429)
  }
  if (!limit || limit.resetAt <= now) {
    rateLimits.set(rateLimitKey, { count: 1, resetAt: now + 60000 })
  } else {
    limit.count++
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return jsonError('AI not configured', 500)

  const s = createAdminSupabaseClient()
  const limitCheck = await checkAILimit(s, actor.shop_id)
  if (!limitCheck.allowed) return jsonError('AI monthly limit reached', 429)

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
      return jsonError('AI service temporarily unavailable', 502)
    }

    const data = await res.json()
    const rawText = data.content?.[0]?.text || ''
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI response could not be parsed', raw: rawText }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])
    await logAIUsage(s, {
      shopId: actor.shop_id,
      userId: actor.id,
      feature: ['service_writer', 'other', 'wo_creation', 'parts_suggest', 'ai_review'].includes(context) ? (context as any) : 'service_writer',
      tokensIn: data.usage?.input_tokens || 0,
      tokensOut: data.usage?.output_tokens || 0,
      model: 'claude-sonnet-4',
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[AI Service Writer] Error:', err)
    return jsonError('AI request failed', 500)
  }
}
