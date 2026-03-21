import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/platform-admin/impersonate — start or stop shop impersonation
export async function POST(req: Request) {
  const s = db()
  const { user_id, shop_id, action } = await req.json()

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: caller } = await s.from('users')
    .select('id, is_platform_owner, shop_id, full_name')
    .eq('id', user_id)
    .single()

  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  if (action === 'start') {
    if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

    // Get shop info
    const { data: shop } = await s.from('shops').select('id, name').eq('id', shop_id).single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    // Set Ken's shop_id to the target shop temporarily
    // We store his original shop_id in metadata so we can restore it
    const originalShopId = caller.shop_id

    await s.from('users').update({
      shop_id: shop_id,
      impersonate_role: 'owner',
    }).eq('id', user_id)

    // Log impersonation start
    await s.from('platform_activity_log').insert({
      action_type: 'impersonation_started',
      description: `${caller.full_name} entered ${shop.name} as Owner`,
      shop_id,
      performed_by: user_id,
      metadata: { original_shop_id: originalShopId },
    })

    return NextResponse.json({ ok: true, shop_name: shop.name, original_shop_id: originalShopId })
  }

  if (action === 'stop') {
    const originalShopId = req.headers.get('x-original-shop-id')

    // Find the most recent impersonation_started log to get original shop_id
    let restoreShopId = originalShopId
    if (!restoreShopId) {
      const { data: lastLog } = await s.from('platform_activity_log')
        .select('metadata, shop_id')
        .eq('performed_by', user_id)
        .eq('action_type', 'impersonation_started')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      restoreShopId = lastLog?.metadata?.original_shop_id || null
    }

    if (!restoreShopId) return NextResponse.json({ error: 'Cannot determine original shop' }, { status: 400 })

    // Get current shop name for logging
    const { data: currentUser } = await s.from('users').select('shop_id').eq('id', user_id).single()
    let shopName = 'Unknown'
    if (currentUser?.shop_id) {
      const { data: sh } = await s.from('shops').select('name').eq('id', currentUser.shop_id).single()
      shopName = sh?.name || 'Unknown'
    }

    await s.from('users').update({
      shop_id: restoreShopId,
      impersonate_role: null,
    }).eq('id', user_id)

    // Log impersonation end
    await s.from('platform_activity_log').insert({
      action_type: 'impersonation_ended',
      description: `${caller.full_name} exited ${shopName}`,
      shop_id: currentUser?.shop_id || null,
      performed_by: user_id,
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action (start/stop)' }, { status: 400 })
}
