import { NextResponse } from 'next/server'
import { getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { rateLimit } from '@/lib/ratelimit/core'

// POST /api/parts/ai-suggest — AI parts suggestion from a job description.
// Authenticated actor required. The route does not read any DB record, so
// shop_id derivation isn't needed; gating is for cost control + abuse
// prevention.
export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const burstLimit = await rateLimit('ai-user', actor.id)
  if (!burstLimit.allowed) return jsonError('Too many AI requests', 429)

  const { job_description } = await req.json()

  if (!job_description || typeof job_description !== 'string' || job_description.trim().length === 0) {
    return NextResponse.json({ error: 'job_description is required' }, { status: 400 })
  }

  if (job_description.length > 2000) {
    return NextResponse.json({ error: 'Description too long (max 2000 characters)' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: 'You are a parts advisor for a semi truck repair shop. Given this job description, list the most commonly needed parts. Return ONLY valid JSON array: [{"description": "...", "quantity": 1, "unit": "each"}]. Max 6 items.',
        messages: [{ role: 'user', content: `Job: ${job_description.trim()}` }],
      }),
    })

    if (!res.ok) {
      console.error('[AI Parts Suggest] API error:', res.status)
      return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 502 })
    }

    const data = await res.json()
    const rawText = data.content?.[0]?.text || ''
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!arrMatch) {
      return NextResponse.json({ error: 'AI response could not be parsed' }, { status: 500 })
    }

    const suggestions = JSON.parse(arrMatch[0])
    return NextResponse.json(suggestions)
  } catch (err) {
    console.error('[AI Parts Suggest] Error:', err)
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}
