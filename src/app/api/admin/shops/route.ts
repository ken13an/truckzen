import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { sendEmail } from '@/lib/services/email'

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.is_platform_owner) return jsonError('Access denied — platform owners only', 403)

  const s = createAdminSupabaseClient()
  const { data: shops, error } = await s.from('shops').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = await Promise.all((shops || []).map(async (shop: any) => {
    const [userCount, woCount, customerCount] = await Promise.all([
      s.from('users').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).is('deleted_at', null),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).is('deleted_at', null),
      s.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).is('deleted_at', null),
    ])
    return { ...shop, user_count: userCount.count || 0, wo_count: woCount.count || 0, customer_count: customerCount.count || 0 }
  }))

  return NextResponse.json(enriched)
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.is_platform_owner) return jsonError('Access denied — platform owners only', 403)

  const s = createAdminSupabaseClient()
  const body = await req.json()
  const { name, dba, phone, email, address, city, state, zip, tax_rate, labor_rate, admin_name, admin_email, admin_password } = body

  if (!name || !admin_name || !admin_email || !admin_password) {
    return NextResponse.json({ error: 'name, admin_name, admin_email, admin_password required' }, { status: 400 })
  }

  const kioskCode = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) + Math.random().toString(36).slice(2, 5).toUpperCase()

  const { data: shop, error: shopErr } = await s.from('shops').insert({
    name, dba: dba || null, phone: phone || null, email: email || null,
    address: address || null, city: city || null, state: state || null, zip: zip || null,
    tax_rate: tax_rate || 0, labor_rate: labor_rate || 0, status: 'active', kiosk_code: kioskCode, setup_complete: true,
  }).select().single()

  if (shopErr || !shop) return NextResponse.json({ error: shopErr?.message || 'Failed to create shop' }, { status: 500 })

  const { data: auth, error: authErr } = await s.auth.admin.createUser({
    email: admin_email.toLowerCase().trim(), password: admin_password,
    email_confirm: true, user_metadata: { full_name: admin_name },
  })

  if (authErr || !auth.user) {
    await s.from('shops').delete().eq('id', shop.id)
    return NextResponse.json({ error: authErr?.message || 'Failed to create auth user' }, { status: 500 })
  }

  const { error: profileErr } = await s.from('users').insert({
    id: auth.user.id, shop_id: shop.id, full_name: admin_name.trim(),
    email: admin_email.toLowerCase().trim(), role: 'owner', active: true, can_create_so: true,
  })

  if (profileErr) {
    await s.auth.admin.deleteUser(auth.user.id)
    await s.from('shops').delete().eq('id', shop.id)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
  sendEmail(admin_email, `Welcome to TruckZen — ${name}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Welcome to TruckZen!</h2><p>Your shop <strong>${name}</strong> has been created.</p><p>Sign in at <a href="${appUrl}/login">${appUrl}/login</a> with your email and the password provided by your admin.</p></div>`
  ).catch(() => {})

  return NextResponse.json(shop, { status: 201 })
}
