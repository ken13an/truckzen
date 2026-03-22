import { NextResponse } from 'next/server'

const SKILLS = 'Engine Repair, Brake Service, Electrical/Diagnostics, Transmission, Suspension, HVAC/AC, Tire Service, Body/Frame, Trailer Repair, Welding, DOT Inspection, Preventive Maintenance, Diesel Fuel Systems, Exhaust/Aftertreatment, Hydraulics'

const SYSTEM_PROMPT = `You are a professional semi truck repair service writer. Take the rough customer complaint and break it into separate professional action items. For each action item, identify which mechanic skills are needed from: ${SKILLS}. Each description should be clear, concise, and in uppercase.

CRITICAL RULES:
1. MERGE DUPLICATES: If the same service is listed multiple times, merge into ONE job line. Never create duplicate lines for the same work.
2. PM SERVICE HIERARCHY: PM Service (Preventive Maintenance) already includes: oil change, oil filter, air filter, fuel filter, coolant check, belt inspection, tire inspection, brake inspection, DEF fluid, grease. If user lists "PM SERVICE" plus any of these individually, merge into just "PM SERVICE". Do NOT create separate lines for services already included in PM.
3. OIL CHANGE: If "oil change" is listed multiple times, merge into one. If "oil change" + "PM Service" → just "PM SERVICE".
4. TIRE JOBS: If tire change/replacement is listed multiple times, keep them as separate lines ONLY if they specify different positions. Otherwise merge.
5. Keep the job description exactly as intended — do NOT auto-upgrade "oil change" to "PM Service" unless the user explicitly wrote both.

Return JSON only: {"action_items": [{"description": "BRAKE SYSTEM INSPECTION - NOISE COMPLAINT", "skills": ["Brake Service", "Suspension"]}, {"description": "OIL AND FILTER SERVICE", "skills": ["Engine Repair", "Preventive Maintenance"]}]}`

export async function POST(req: Request) {
  const { complaint } = await req.json()
  if (!complaint?.trim()) return NextResponse.json({ error: 'complaint required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
  }

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
      console.error('[AI] API error:', res.status)
      return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed.action_items) && parsed.action_items.length > 0) {
        // Normalize: support both old format (string[]) and new format ({description, skills}[])
        const items = parsed.action_items.map((item: any) => {
          if (typeof item === 'string') return { description: item, skills: [] }
          return { description: item.description || item, skills: Array.isArray(item.skills) ? item.skills : [] }
        })
        return NextResponse.json({ action_items: items })
      }
    }

    return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
  } catch (err) {
    console.error('[AI] Error:', err)
    return NextResponse.json({ action_items: [{ description: complaint.trim().toUpperCase(), skills: [] }] })
  }
}
