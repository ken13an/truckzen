import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { getPartSuggestions } from '@/lib/parts-suggestions'

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const { so_id, complaint, truck_info, service_type } = await req.json().catch(() => ({}))
  if (!complaint || typeof complaint !== 'string') return jsonError('Complaint required', 400)

  const shopId = getActorShopId(actor)
  const admin = createAdminSupabaseClient()
  const { data: inventoryParts } = shopId
    ? await admin.from('parts').select('id, part_number, description, on_hand').eq('shop_id', shopId).is('deleted_at', null).limit(500)
    : { data: [] as any[] }

  const formulaSuggestions = getPartSuggestions(complaint, (inventoryParts || []) as any[])
    .slice(0, 8)
    .map((part: any) => ({
      part_number: part.part_number || null,
      description: part.description,
      category: part.source === 'inventory' ? 'Inventory' : 'Common',
      quantity: 1,
      confidence: part.source === 'inventory' ? 'high' : 'medium',
      required: true,
      reason: part.source === 'inventory' ? 'Matched your inventory catalog.' : 'Commonly needed for this repair.',
      in_catalog: part.source === 'inventory',
      catalog_id: part.id || null,
      estimated_sell_price: 0,
    }))

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ suggestions: formulaSuggestions, so_id })

  try {
    const catalogStr = (inventoryParts || []).slice(0, 80).map((p: any) => `${p.part_number || 'NO-PN'} | ${p.description} | Stock: ${p.on_hand}`).join('\n') || 'No catalog available'
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 900,
        system: 'You are a heavy truck parts expert. Suggest parts for the repair. Return ONLY valid JSON array of objects with keys: part_number, description, category, quantity, confidence, required, reason, in_catalog, catalog_id, estimated_sell_price.',
        messages: [{
          role: 'user',
          content: `Truck: ${truck_info?.year || ''} ${truck_info?.make || ''} ${truck_info?.model || ''} ${truck_info?.engine || ''}\nService type: ${service_type || 'General repair'}\nComplaint: ${complaint.trim()}\n\nCatalog:\n${catalogStr}`
        }],
      }),
    })
    if (!res.ok) return NextResponse.json({ suggestions: formulaSuggestions, so_id })
    const data = await res.json()
    const raw = data.content?.[0]?.text || ''
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const arrMatch = clean.match(/\[[\s\S]*\]/)
    if (!arrMatch) return NextResponse.json({ suggestions: formulaSuggestions, so_id })
    const suggestions = JSON.parse(arrMatch[0])
    return NextResponse.json({ suggestions: Array.isArray(suggestions) && suggestions.length ? suggestions : formulaSuggestions, so_id })
  } catch {
    return NextResponse.json({ suggestions: formulaSuggestions, so_id })
  }
}
