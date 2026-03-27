import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const user = await getAuthenticatedUserProfile()
  if (!user) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(user)
  if (!shopId) return jsonError('No shop context', 400)

  const { searchParams } = new URL(req.url)
  const partNumber = searchParams.get('part_number')
  const customerId = searchParams.get('customer_id')

  if (!partNumber) return NextResponse.json({ error: 'part_number required' }, { status: 400 })

  const s = db()

  // Look up part
  const { data: part } = await s
    .from('parts')
    .select('id, part_number, description, on_hand, sell_price, price_ugl_company, price_ugl_owner_operator, price_outside, bin_location')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .ilike('part_number', partNumber)
    .limit(1)
    .single()

  if (!part) return NextResponse.json({ found: false })

  // Get customer pricing tier if customer_id provided
  let pricingTier = 'outside'
  if (customerId) {
    const { data: cust } = await s
      .from('customers')
      .select('pricing_tier')
      .eq('id', customerId)
      .single()
    if (cust?.pricing_tier) pricingTier = cust.pricing_tier
  }

  // Determine correct price based on tier
  let unitPrice: number | null = null
  if (pricingTier === 'ugl_company') {
    unitPrice = part.price_ugl_company ?? part.sell_price ?? null
  } else if (pricingTier === 'ugl_owner_operator') {
    unitPrice = part.price_ugl_owner_operator ?? part.sell_price ?? null
  } else {
    unitPrice = part.price_outside ?? part.sell_price ?? null
  }

  return NextResponse.json({
    found: true,
    id: part.id,
    part_number: part.part_number,
    description: part.description,
    unit_price: unitPrice,
    in_stock: (part.on_hand ?? 0) > 0,
    on_hand: part.on_hand ?? 0,
    bin_location: part.bin_location,
    pricing_tier: pricingTier,
  })
}
