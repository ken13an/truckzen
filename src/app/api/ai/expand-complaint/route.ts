import { NextResponse } from 'next/server'
import { getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { rateLimit } from '@/lib/ratelimit/core'

function fallbackExpand(complaint: string) {
  return complaint
    .split(/\n|;|\.|, and | and /i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((description) => ({ description, estimated_hours: 0 }))
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const burstLimit = await rateLimit('ai-user', actor.id)
  if (!burstLimit.allowed) return jsonError('Too many AI requests', 429)

  const body = await req.json().catch(() => null)
  const complaint = typeof body?.complaint === 'string' ? body.complaint.trim() : ''
  const asset = body?.asset || {}
  if (!complaint) return jsonError('complaint required', 400)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ lines: fallbackExpand(complaint) })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: 'You are a heavy-truck service writer. Split a customer complaint into clean job lines. Return ONLY valid JSON object: {"lines":[{"description":"...","estimated_hours":0}]} Keep lines concise and repair-focused. Do not invent parts. IMPORTANT: If the complaint says replace/replacement, keep the job as a replacement — do NOT rewrite it as inspection or service. Preserve the original repair intent exactly. Diagnostic lines are only for truly unclear complaints.',
        messages: [{
          role: 'user',
          content: `Truck: ${asset?.year || ''} ${asset?.make || ''} ${asset?.model || ''} ${asset?.engine || ''}\nComplaint: ${complaint}`
        }],
      }),
    })

    if (!res.ok) return NextResponse.json({ lines: fallbackExpand(complaint) })
    const data = await res.json()
    const rawText = data.content?.[0]?.text || ''
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ lines: fallbackExpand(complaint) })
    const parsed = JSON.parse(match[0])
    const lines = Array.isArray(parsed?.lines) ? parsed.lines.filter((l: any) => typeof l?.description === 'string' && l.description.trim()) : []
    return NextResponse.json({ lines: lines.length ? lines : fallbackExpand(complaint) })
  } catch {
    return NextResponse.json({ lines: fallbackExpand(complaint) })
  }
}
