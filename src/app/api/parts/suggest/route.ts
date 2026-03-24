import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { checkRateLimit, detectPromptInjection } from '@/lib/security'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip    = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const limit = await checkRateLimit('ai', `${user.id}:${ip}`)
  if (!limit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  const { so_id, complaint, truck_info, service_type } = await req.json()
  if (!complaint) return NextResponse.json({ error: 'Complaint required' }, { status: 400 })

  const check = detectPromptInjection(complaint)
  if (!check.isSafe) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // Pull catalog for context — top 60 parts by usage
  const { data: catalog } = await supabase
    .from('parts')
    .select('id, part_number, description, category, on_hand, reorder_point, sell_price')
    .eq('shop_id', user.shop_id)
    .is('deleted_at', null)
    .order('description')
    .limit(60)

  const catalogStr = catalog?.map(p =>
    `${p.part_number || 'NO-PN'} | ${p.description} | ${p.category} | Stock: ${p.on_hand} | $${p.sell_price}`
  ).join('\n') || 'No catalog available'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    system: `You are a heavy truck parts expert for a repair shop.
Given a service complaint and parts catalog, suggest parts needed for the repair.
Return ONLY valid JSON array:
[{
  "part_number": "from catalog or null",
  "description": "part description",
  "category": "Engine|Brakes|Electrical|etc",
  "quantity": 1,
  "confidence": "very_high|high|medium|low",
  "required": true,
  "reason": "why this part is needed (1 sentence)",
  "in_catalog": true,
  "catalog_id": "uuid from catalog or null",
  "estimated_sell_price": 0
}]
Match parts to catalog when possible. Include only relevant parts. Required=true means essential, false means inspect/replace as needed.`,
    messages: [{
      role: 'user',
      content: `Truck: ${truck_info?.year || ''} ${truck_info?.make || ''} ${truck_info?.model || ''} ${truck_info?.engine || ''}
Service type: ${service_type || 'General repair'}
Complaint: ${check.sanitized}

Shop catalog:
${catalogStr}

Suggest parts needed.`
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const clean = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
    const suggestions = JSON.parse(clean)
    return NextResponse.json({ suggestions, so_id })
  } catch {
    return NextResponse.json({ error: 'AI parsing error' }, { status: 500 })
  }
}
