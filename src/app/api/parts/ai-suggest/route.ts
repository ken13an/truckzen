import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
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
