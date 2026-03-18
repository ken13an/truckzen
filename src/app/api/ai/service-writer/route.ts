// app/api/ai/service-writer/route.ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit, detectPromptInjection } from '@/lib/security'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const LANG_NAMES: Record<string, string> = {
  en: 'English', ru: 'Russian', uz: 'Uzbek', es: 'Spanish',
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user     = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit — 30 AI calls per minute
  const ip    = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const limit = await checkRateLimit('ai', `${user.id}:${ip}`)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many AI requests. Wait a moment.' }, { status: 429 })
  }

  const { transcript, language = 'en', truck_info, complaint, so_id } = await req.json()

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json({ error: 'Transcript required' }, { status: 400 })
  }

  // Security — scan for prompt injection
  const check = detectPromptInjection(transcript)
  if (!check.isSafe) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const langName = LANG_NAMES[language] || 'English'
  const isEnglish = language === 'en'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    system: `You are an expert heavy truck service writer for a professional repair shop.
Generate professional, technically accurate service notes from mechanic voice input.
The mechanic may speak in ${langName}. The OFFICIAL record must always be in English.

Return ONLY valid JSON with these exact fields:
{
  "cause": "Professional cause statement in English (2-3 sentences, technically precise)",
  "correction": "Professional correction/repair procedure in English (2-4 sentences)",
  "cause_native": ${isEnglish ? 'null' : `"Same cause in ${langName} for mechanic reference"`},
  "correction_native": ${isEnglish ? 'null' : `"Same correction in ${langName} for mechanic reference"`},
  "suggested_parts": ["part description 1", "part description 2"],
  "labor_hours_estimate": 0.0,
  "confidence": "high|medium|low"
}

Be specific about the truck component, failure mode, and repair procedure.
Use proper trucking terminology (e.g. "PACCAR MX-13", "Allison transmission", "rear main seal").`,
    messages: [{
      role: 'user',
      content: `Truck: ${truck_info?.year || ''} ${truck_info?.make || ''} ${truck_info?.model || ''} ${truck_info?.engine || ''}
Customer complaint: ${complaint || 'Not recorded'}
Mechanic voice input (${langName}): "${check.sanitized}"

Generate the service notes.`,
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  let result: any

  try {
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    result = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: 'AI parsing error — try again' }, { status: 500 })
  }

  // If SO ID provided, optionally auto-save to draft
  if (so_id && result.cause && result.correction) {
    // Don't auto-save — tech must explicitly accept
    // This just returns the suggestion
  }

  return NextResponse.json(result)
}
