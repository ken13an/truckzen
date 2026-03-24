import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const partNumber = searchParams.get('part_number')
  const customerId = searchParams.get('customer_id')

  if (!partNumber) return NextResponse.json({ error: 'part_number required' }, { status: 400 })

  // Look up part
  const { data: part } = await supabase
    .from('parts')
    .select('id, part_number, description, on_hand, sell_price, price_ugl_company, price_ugl_owner_operator, price_outside, bin_location')
    .eq('shop_id', user.shop_id)
    .is('deleted_at', null)
    .ilike('part_number', partNumber)
    .limit(1)
    .single()

  if (!part) return NextResponse.json({ found: false })

  // Get customer pricing tier if customer_id provided
  let pricingTier = 'outside'
  if (customerId) {
    const { data: cust } = await supabase
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
