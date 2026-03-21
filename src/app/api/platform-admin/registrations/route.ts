import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/services/email'
import { emailWrapper, blueButton } from '@/lib/emails/wrapper'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/platform-admin/registrations — list registrations
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', userId).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { data, error } = await s.from('shop_registrations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST /api/platform-admin/registrations — public: submit a new registration
export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { shop_name, owner_name, owner_email, owner_phone, address, city, state, zip, fleet_size, current_software, message } = body

  if (!shop_name || !owner_name || !owner_email) {
    return NextResponse.json({ error: 'shop_name, owner_name, owner_email required' }, { status: 400 })
  }

  const { data, error } = await s.from('shop_registrations').insert({
    shop_name,
    owner_name,
    owner_email: owner_email.toLowerCase().trim(),
    owner_phone: owner_phone || null,
    address: address || null,
    city: city || null,
    state: state || null,
    zip: zip || null,
    fleet_size: fleet_size || null,
    current_software: current_software || null,
    message: message || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  await s.from('platform_activity_log').insert({
    action_type: 'registration_received',
    description: `New registration: ${shop_name} (${owner_email})`,
    metadata: { registration_id: data.id, shop_name, owner_email },
  })

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/platform-admin/registrations — approve or reject
export async function PATCH(req: Request) {
  const s = db()
  const body = await req.json()
  const { user_id, registration_id, action, reject_reason } = body

  if (!user_id || !registration_id || !action) {
    return NextResponse.json({ error: 'user_id, registration_id, action required' }, { status: 400 })
  }

  const { data: caller } = await s.from('users').select('id, is_platform_owner, full_name').eq('id', user_id).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { data: reg } = await s.from('shop_registrations').select('*').eq('id', registration_id).single()
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
  const platformShop = { name: 'TruckZen', phone: '', logoUrl: null }

  if (action === 'approve') {
    // Generate kiosk code
    const kioskCode = reg.shop_name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) + Math.random().toString(36).slice(2, 5).toUpperCase()

    // Create shop
    const { data: shop, error: shopErr } = await s.from('shops').insert({
      name: reg.shop_name,
      phone: reg.owner_phone || null,
      email: reg.owner_email,
      address: reg.address || null,
      city: reg.city || null,
      state: reg.state || null,
      zip: reg.zip || null,
      status: 'active',
      kiosk_code: kioskCode,
      setup_complete: false,
      onboarded_at: new Date().toISOString(),
      onboarded_by: user_id,
    }).select().single()

    if (shopErr || !shop) {
      return NextResponse.json({ error: shopErr?.message || 'Failed to create shop' }, { status: 500 })
    }

    // Generate temp password
    const tempPassword = 'TZ-' + Math.random().toString(36).slice(2, 10).toUpperCase()

    // Create auth user
    const { data: auth, error: authErr } = await s.auth.admin.createUser({
      email: reg.owner_email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: reg.owner_name },
    })

    if (authErr || !auth.user) {
      await s.from('shops').delete().eq('id', shop.id)
      return NextResponse.json({ error: authErr?.message || 'Failed to create user' }, { status: 500 })
    }

    // Create user profile
    await s.from('users').insert({
      id: auth.user.id,
      shop_id: shop.id,
      full_name: reg.owner_name.trim(),
      email: reg.owner_email.toLowerCase().trim(),
      role: 'owner',
      active: true,
      can_create_so: true,
    })

    // Update registration
    await s.from('shop_registrations').update({
      status: 'approved',
      reviewed_by: user_id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', registration_id)

    // Send welcome email
    const welcomeHtml = emailWrapper(platformShop, `
      <h2 style="color: #F0F4FF; margin: 0 0 8px;">Welcome to TruckZen!</h2>
      <p style="color: #7C8BA0; margin: 0 0 16px;">Your shop <strong style="color: #F0F4FF;">${reg.shop_name}</strong> has been approved and is ready to go.</p>
      <div style="background: #161B24; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 16px 0;">
        <p style="margin: 0; color: #7C8BA0; font-size: 12px;">YOUR LOGIN CREDENTIALS</p>
        <p style="margin: 8px 0 0; color: #F0F4FF;"><strong>Email:</strong> ${reg.owner_email}</p>
        <p style="margin: 4px 0 0; color: #F0F4FF;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p style="color: #7C8BA0; font-size: 12px;">Please change your password after your first login.</p>
      ${blueButton('Sign In to TruckZen', `${appUrl}/login`)}
    `)
    sendEmail(reg.owner_email, `Your TruckZen account is ready — ${reg.shop_name}`, welcomeHtml).catch(() => {})

    // Log
    await s.from('platform_activity_log').insert({
      action_type: 'shop_approved',
      description: `Approved registration: ${reg.shop_name} (${reg.owner_email})`,
      shop_id: shop.id,
      performed_by: user_id,
      metadata: { registration_id },
    })

    return NextResponse.json({ ok: true, shop_id: shop.id })
  }

  if (action === 'reject') {
    if (!reject_reason) return NextResponse.json({ error: 'reject_reason required' }, { status: 400 })

    await s.from('shop_registrations').update({
      status: 'rejected',
      reviewed_by: user_id,
      reviewed_at: new Date().toISOString(),
      reject_reason,
    }).eq('id', registration_id)

    // Send rejection email
    const rejectHtml = emailWrapper(platformShop, `
      <h2 style="color: #F0F4FF; margin: 0 0 8px;">Registration Update</h2>
      <p style="color: #7C8BA0;">Thank you for your interest in TruckZen. Unfortunately, we are unable to onboard your shop <strong style="color: #F0F4FF;">${reg.shop_name}</strong> at this time.</p>
      <div style="background: #161B24; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 16px 0;">
        <p style="margin: 0; color: #7C8BA0; font-size: 12px;">REASON</p>
        <p style="margin: 8px 0 0; color: #F0F4FF;">${reject_reason}</p>
      </div>
      <p style="color: #7C8BA0; font-size: 12px;">If you have questions, please contact us at support@truckzen.pro.</p>
    `)
    sendEmail(reg.owner_email, `TruckZen Registration Update — ${reg.shop_name}`, rejectHtml).catch(() => {})

    // Log
    await s.from('platform_activity_log').insert({
      action_type: 'shop_rejected',
      description: `Rejected registration: ${reg.shop_name} — ${reject_reason}`,
      performed_by: user_id,
      metadata: { registration_id, reject_reason },
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
