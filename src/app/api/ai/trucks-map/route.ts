import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { rateLimit } from '@/lib/ratelimit/core'

// POST /api/ai/trucks-map — AI column mapping for truck import.
// Authenticated actor required. The route does not read any DB record, so
// no shop_id derivation is needed beyond gating access (cost control +
// abuse prevention). Smart-drop UI caller already runs authenticated; the
// page is in middleware PUBLIC_PATHS but its own useEffect redirects to
// /login when no session, so the fetch from the page carries the cookie.
export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const burstLimit = await rateLimit('ai-user', actor.id)
  if (!burstLimit.allowed) return NextResponse.json({ error: 'Too many AI requests' }, { status: 429 })

  const { headers: fileHeaders } = await req.json()

  if (!fileHeaders || !Array.isArray(fileHeaders)) {
    return NextResponse.json({ error: 'headers array required' }, { status: 400 })
  }

  const truckzenFields = [
    'unit_number', 'vin', 'year', 'make', 'model', 'type',
    'license_plate', 'license_state', 'mileage', 'customer_name',
    'is_owner_operator', 'contact_email', 'contact_phone', 'notes',
  ]

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a column mapping assistant for a truck fleet management system.

Given these column headers from a user's spreadsheet:
${JSON.stringify(fileHeaders)}

Map each to the best matching TruckZen field from this list:
${JSON.stringify(truckzenFields)}

Return ONLY a JSON array where each element is:
{"header": "original header", "field": "truckzen_field or __unmapped", "confidence": 0-100}

Rules:
- "unit" or "truck #" or "equipment" → unit_number
- "vin" or "serial" → vin
- "year" or "yr" or "model year" → year
- "make" or "manufacturer" → make
- "model" → model
- "type" or "unit type" or "vehicle type" → type
- "plate" or "license" or "tag" → license_plate
- "state" combined with license context → license_state
- "miles" or "odometer" or "mileage" → mileage
- "company" or "customer" or "carrier" or "fleet name" → customer_name
- "owner operator" or "O/O" → is_owner_operator
- "email" → contact_email
- "phone" or "tel" → contact_phone
- "notes" or "comments" → notes
- If no good match, use "__unmapped" with confidence 0

Return ONLY the JSON array, no other text.`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const mappings = JSON.parse(jsonMatch[0])
      return NextResponse.json({ mappings })
    }

    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  } catch (err: any) {
    // Fallback: use simple heuristic mapping
    const mappings = fileHeaders.map((h: string) => {
      const lower = h.toLowerCase().trim()
      let field = '__unmapped'
      let confidence = 0

      const rules: [RegExp, string][] = [
        [/unit|truck\s*#|equip|asset|fleet\s*#/i, 'unit_number'],
        [/^vin$|vin\s*#|serial/i, 'vin'],
        [/^year$|yr$|model\s*year/i, 'year'],
        [/^make$|manufacturer|brand|mfg$/i, 'make'],
        [/^model$|mdl$/i, 'model'],
        [/^type$|unit\s*type|vehicle\s*type|equip\s*type/i, 'type'],
        [/plate|license.*plate|tag/i, 'license_plate'],
        [/license.*state|^state$/i, 'license_state'],
        [/mile|odometer|odo/i, 'mileage'],
        [/company|customer|carrier|fleet\s*name|business/i, 'customer_name'],
        [/owner.*op|o\/o/i, 'is_owner_operator'],
        [/email/i, 'contact_email'],
        [/phone|tel|mobile|cell/i, 'contact_phone'],
        [/note|comment|remark/i, 'notes'],
      ]

      for (const [regex, f] of rules) {
        if (regex.test(lower)) { field = f; confidence = 85; break }
      }

      return { header: h, field, confidence }
    })

    return NextResponse.json({ mappings })
  }
}
