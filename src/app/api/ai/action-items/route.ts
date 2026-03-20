import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { complaint } = await req.json()
  if (!complaint?.trim()) return NextResponse.json({ error: 'complaint required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Fallback: return raw text as single action item
    return NextResponse.json({ action_items: [complaint.trim().toUpperCase()] })
  }

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
        max_tokens: 1024,
        system: 'You are a professional semi truck repair service writer. Take the rough customer complaint or service request and break it into separate professional action items. Each action item should be a clear, concise repair task in uppercase. Return JSON only: {"action_items": ["OIL AND FILTER SERVICE", "REPLACE WINDSHIELD", "INSPECT BRAKE SYSTEM - NOISE COMPLAINT"]}',
        messages: [{ role: 'user', content: complaint.trim() }],
      }),
    })

    if (!res.ok) {
      console.error('[AI Action Items] API error:', res.status)
      return NextResponse.json({ action_items: [complaint.trim().toUpperCase()] })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed.action_items) && parsed.action_items.length > 0) {
        return NextResponse.json({ action_items: parsed.action_items })
      }
    }

    // Fallback if parsing fails
    return NextResponse.json({ action_items: [complaint.trim().toUpperCase()] })
  } catch (err) {
    console.error('[AI Action Items] Error:', err)
    return NextResponse.json({ action_items: [complaint.trim().toUpperCase()] })
  }
}
