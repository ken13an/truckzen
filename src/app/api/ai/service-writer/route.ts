import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', ru: 'Russian', uz: 'Uzbek', es: 'Spanish',
}

export async function POST(req: Request) {
  const body = await req.json()
  const { transcript, language = 'en', truck_info, complaint, shop_id, role } = body

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json({ error: 'Transcript required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const langName = LANG_NAMES[language] || 'English'
  const isEnglish = language === 'en'

  // Determine system prompt based on role
  let roleContext = ''
  if (role === 'technician' || role === 'maintenance_technician') {
    roleContext = 'The user is a MECHANIC writing technical findings. Focus on diagnosis details and repair notes.'
  } else if (role === 'parts_manager' || role === 'parts_department') {
    roleContext = 'The user is from the PARTS DEPARTMENT. Focus on identifying exact parts needed with quantities.'
  } else if (role === 'shop_manager' || role === 'maintenance_manager') {
    roleContext = 'The user is a FLOOR SUPERVISOR. Focus on assignment notes and priority assessment.'
  } else {
    roleContext = 'The user is a SERVICE WRITER creating a professional service order. Write complete complaint, cause, and correction.'
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are an expert heavy-duty truck service writer for a professional diesel repair shop.
${roleContext}
The mechanic may speak in ${langName}. ALL output must be in English.

Return ONLY valid JSON:
{
  "complaint": "Professional complaint summary (what the customer/driver reported)",
  "cause": "Technical cause statement (2-3 sentences, precise terminology)",
  "correction": "Repair procedure (2-4 sentences, step by step)",
  "suggested_parts": [{"name": "part description", "part_number": "if known", "quantity": 1}],
  "labor_hours_min": 0.0,
  "labor_hours_max": 0.0,
  "department": "engine|electrical|brakes|body_chassis|transmission|diagnostic|inspection|other",
  "confidence": "high|medium|low"
}

Use proper heavy truck terminology (PACCAR MX-13, Cummins ISX15, Allison 3000, Eaton Fuller, etc).

MOTOR LABOR TIME REFERENCES (approximate hours for Class 8 trucks):
- Oil change + filters: 0.8 - 1.5 hrs
- Fuel filter replacement: 0.5 - 1.0 hrs
- Air filter replacement: 0.3 - 0.5 hrs
- Brake pad/shoe replacement (per axle): 2.0 - 4.0 hrs
- Brake drum replacement (per axle): 3.0 - 5.0 hrs
- DPF cleaning/replacement: 2.0 - 4.0 hrs
- Turbo replacement: 4.0 - 8.0 hrs
- Rear main seal: 6.0 - 10.0 hrs
- Head gasket: 12.0 - 20.0 hrs
- Injector replacement (per injector): 1.5 - 3.0 hrs
- Alternator replacement: 1.0 - 2.5 hrs
- Starter replacement: 1.5 - 3.0 hrs
- AC compressor: 2.0 - 4.0 hrs
- Water pump: 2.0 - 4.0 hrs
- Clutch replacement: 6.0 - 10.0 hrs
- Transmission rebuild: 12.0 - 24.0 hrs
- Wheel seal replacement: 1.0 - 2.0 hrs
- King pin replacement: 3.0 - 6.0 hrs
- Leaf spring replacement: 2.0 - 4.0 hrs
- DEF system repair: 1.0 - 3.0 hrs
- EGR valve: 1.5 - 3.0 hrs
- PM service (full inspection): 1.5 - 3.0 hrs
- DOT annual inspection: 1.0 - 2.0 hrs

Use these ranges for labor_hours_min and labor_hours_max based on the repair type.`,
      messages: [{
        role: 'user',
        content: `Truck: ${truck_info?.year || ''} ${truck_info?.make || ''} ${truck_info?.model || ''} ${truck_info?.engine || ''}
Customer complaint: ${complaint || 'Not provided'}
Voice input (${langName}): "${transcript}"

Generate professional service notes.`,
      }],
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 })
  }

  const data = await response.json()
  const raw = data.content?.[0]?.text || ''

  let result: any
  try {
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    result = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: 'AI parsing error — try again', raw }, { status: 500 })
  }

  // Match suggested parts against inventory
  if (shop_id && result.suggested_parts?.length > 0) {
    const s = db()
    const { data: inventory } = await s.from('parts')
      .select('id, part_number, description, on_hand, reorder_point, sell_price, bin_location')
      .eq('shop_id', shop_id)
      .limit(500)

    if (inventory) {
      result.suggested_parts = result.suggested_parts.map((sp: any) => {
        const name = (sp.name || sp).toLowerCase()
        const match = inventory.find(p =>
          p.description?.toLowerCase().includes(name) ||
          name.includes(p.description?.toLowerCase() || '') ||
          (sp.part_number && p.part_number?.toLowerCase().includes(sp.part_number.toLowerCase()))
        )
        return {
          ...sp,
          inventory_match: match ? {
            id: match.id,
            part_number: match.part_number,
            description: match.description,
            on_hand: match.on_hand,
            sell_price: match.sell_price,
            bin_location: match.bin_location,
            in_stock: match.on_hand > 0,
            low_stock: match.on_hand > 0 && match.on_hand <= (match.reorder_point || 2),
          } : null,
        }
      })
    }
  }

  return NextResponse.json(result)
}
