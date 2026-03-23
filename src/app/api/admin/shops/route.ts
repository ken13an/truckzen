import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/services/email'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getPlatformUser(s: ReturnType<typeof db>, req: Request) {
  // Get auth user from authorization header or cookie
  const authHeader = req.headers.get('authorization')
  const url = new URL(req.url)
  const userId = url.searchParams.get('user_id') || authHeader?.replace('Bearer ', '')

  if (!userId) return null

  const { data: user } = await s.from('users')
    .select('id, shop_id, full_name, email, role, is_platform_owner, can_impersonate')
    .eq('id', userId)
    .single()

  if (!user?.is_platform_owner) return null
  return user
}

// GET /api/admin/shops — list all shops with stats
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Verify platform owner
  const { data: caller } = await s.from('users')
    .select('id, is_platform_owner')
    .eq('id', userId)
    .single()

  if (!caller?.is_platform_owner) {
    return NextResponse.json({ error: 'Access denied — platform owners only' }, { status: 403 })
  }

  // Get all shops
  const { data: shops, error } = await s.from('shops')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get stats for each shop
  const enriched = await Promise.all((shops || []).map(async (shop: any) => {
    const [userCount, woCount, customerCount] = await Promise.all([
      s.from('users').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).is('deleted_at', null),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).is('deleted_at', null),
      s.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).is('deleted_at', null),
    ])

    return {
      ...shop,
      user_count: userCount.count || 0,
      wo_count: woCount.count || 0,
      customer_count: customerCount.count || 0,
    }
  }))

  return NextResponse.json(enriched)
}

// POST /api/admin/shops — create new shop
export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { user_id, name, dba, phone, email, address, city, state, zip, tax_rate, labor_rate, admin_name, admin_email, admin_password } = body

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Verify platform owner
  const { data: caller } = await s.from('users')
    .select('id, is_platform_owner')
    .eq('id', user_id)
    .single()

  if (!caller?.is_platform_owner) {
    return NextResponse.json({ error: 'Access denied — platform owners only' }, { status: 403 })
  }

  if (!name || !admin_name || !admin_email || !admin_password) {
    return NextResponse.json({ error: 'name, admin_name, admin_email, admin_password required' }, { status: 400 })
  }

  // Generate kiosk code from shop name
  const kioskCode = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) + Math.random().toString(36).slice(2, 5).toUpperCase()

  // 1. Insert shop
  const { data: shop, error: shopErr } = await s.from('shops').insert({
    name,
    dba: dba || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
    city: city || null,
    state: state || null,
    zip: zip || null,
    tax_rate: tax_rate || 0,
    labor_rate: labor_rate || 0,
    status: 'active',
    kiosk_code: kioskCode,
    setup_complete: true,
  }).select().single()

  if (shopErr || !shop) {
    return NextResponse.json({ error: shopErr?.message || 'Failed to create shop' }, { status: 500 })
  }

  // 2. Create auth user
  const { data: auth, error: authErr } = await s.auth.admin.createUser({
    email: admin_email.toLowerCase().trim(),
    password: admin_password,
    email_confirm: true,
    user_metadata: { full_name: admin_name },
  })

  if (authErr || !auth.user) {
    // Rollback shop
    await s.from('shops').delete().eq('id', shop.id)
    return NextResponse.json({ error: authErr?.message || 'Failed to create auth user' }, { status: 500 })
  }

  // 3. Insert user profile
  const { error: profileErr } = await s.from('users').insert({
    id: auth.user.id,
    shop_id: shop.id,
    full_name: admin_name.trim(),
    email: admin_email.toLowerCase().trim(),
    role: 'owner',
    active: true,
    can_create_so: true,
  })

  if (profileErr) {
    // Rollback
    await s.auth.admin.deleteUser(auth.user.id)
    await s.from('shops').delete().eq('id', shop.id)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // 4. Send welcome email (fire-and-forget)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
  sendEmail(
    admin_email,
    `Welcome to TruckZen — ${name}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Welcome to TruckZen!</h2>
      <p>Your shop <strong>${name}</strong> has been created.</p>
      <p>Sign in at <a href="${appUrl}/login">${appUrl}/login</a> with your email and the password provided by your admin.</p>
    </div>`
  ).catch(() => {})

  return NextResponse.json(shop, { status: 201 })
}
