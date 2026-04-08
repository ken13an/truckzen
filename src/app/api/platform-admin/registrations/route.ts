import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getRequestIp } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'
import { sendEmail } from '@/lib/services/email'
import { emailWrapper, blueButton } from '@/lib/emails/wrapper'
import { checkRateLimit } from '@/lib/rateLimit'

export async function GET() {
  const { error } = await requirePlatformOwner()
  if (error) return error

  const s = createAdminSupabaseClient()
  const { data, error: dbError } = await s.from('shop_registrations').select('*').order('created_at', { ascending: false })
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data || [])
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: Request) {
  const ip = getRequestIp(req)
  // Tight rate limit: 3 registrations per hour per IP
  if (!checkRateLimit(`registration:${ip}`, 3, 3_600_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)

  // Honeypot — hidden field that bots fill. Legitimate users never see it.
  if (body?.company_website) {
    return NextResponse.json({ id: 'ok' }, { status: 201 })
  }

  const shopName = typeof body?.shop_name === 'string' ? body.shop_name.trim() : ''
  const ownerName = typeof body?.owner_name === 'string' ? body.owner_name.trim() : ''
  const ownerEmail = typeof body?.owner_email === 'string' ? body.owner_email.toLowerCase().trim() : ''
  if (!shopName || !ownerName || !ownerEmail) {
    return NextResponse.json({ error: 'Shop name, your name, and email are required.' }, { status: 400 })
  }

  // Email format validation
  if (!EMAIL_RE.test(ownerEmail)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  // Duplicate pending registration check — generic response to avoid email enumeration
  const { data: existing } = await s.from('shop_registrations')
    .select('id').eq('owner_email', ownerEmail).eq('status', 'pending').limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({ id: 'ok' }, { status: 201 })
  }

  const { data, error: dbError } = await s.from('shop_registrations').insert({
    shop_name: shopName,
    owner_name: ownerName,
    owner_email: ownerEmail,
    owner_phone: body?.owner_phone || null,
    address: body?.address || null,
    city: body?.city || null,
    state: body?.state || null,
    zip: body?.zip || null,
    fleet_size: body?.fleet_size || null,
    current_software: body?.current_software || null,
    message: body?.message || null,
  }).select().single()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  await s.from('platform_activity_log').insert({ action_type: 'registration_received', description: `New registration: ${shopName} (${ownerEmail})`, metadata: { registration_id: data.id, shop_name: shopName, owner_email: ownerEmail, ip_address: ip } })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const { actor, error } = await requirePlatformOwner()
  if (error || !actor) return error

  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)
  const registrationId = typeof body?.registration_id === 'string' ? body.registration_id : ''
  const action = typeof body?.action === 'string' ? body.action : ''
  const rejectReason = typeof body?.reject_reason === 'string' ? body.reject_reason : ''
  if (!registrationId || !action) return NextResponse.json({ error: 'registration_id and action required' }, { status: 400 })

  const { data: reg } = await s.from('shop_registrations').select('*').eq('id', registrationId).single()
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
  const platformShop = { name: 'TruckZen', phone: '', logoUrl: null }

  if (action === 'approve') {
    const kioskCode = reg.shop_name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) + Math.random().toString(36).slice(2, 5).toUpperCase()
    const { data: shop, error: shopErr } = await s.from('shops').insert({ name: reg.shop_name, phone: reg.owner_phone || null, email: reg.owner_email, address: reg.address || null, city: reg.city || null, state: reg.state || null, zip: reg.zip || null, status: 'active', kiosk_code: kioskCode, setup_complete: false, onboarded_at: new Date().toISOString(), onboarded_by: actor.id }).select().single()
    if (shopErr || !shop) return NextResponse.json({ error: shopErr?.message || 'Failed to create shop' }, { status: 500 })

    const tempPassword = 'TZ-' + Math.random().toString(36).slice(2, 10).toUpperCase()
    const { data: auth, error: authErr } = await s.auth.admin.createUser({ email: reg.owner_email.toLowerCase().trim(), password: tempPassword, email_confirm: true, user_metadata: { full_name: reg.owner_name } })
    if (authErr || !auth.user) {
      await s.from('shops').delete().eq('id', shop.id)
      return NextResponse.json({ error: authErr?.message || 'Failed to create user' }, { status: 500 })
    }

    await s.from('users').insert({ id: auth.user.id, shop_id: shop.id, full_name: reg.owner_name.trim(), email: reg.owner_email.toLowerCase().trim(), role: 'owner', active: true, can_create_so: true })
    await s.from('shop_registrations').update({ status: 'approved', reviewed_by: actor.id, reviewed_at: new Date().toISOString() }).eq('id', registrationId)

    const welcomeHtml = emailWrapper(platformShop, `<h2 style="color: #F0F4FF; margin: 0 0 8px;">Welcome to TruckZen!</h2><p style="color: #7C8BA0; margin: 0 0 16px;">Your shop <strong style="color: #F0F4FF;">${reg.shop_name}</strong> has been approved and is ready to go.</p><div style="background: #161B24; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 16px 0;"><p style="margin: 0; color: #7C8BA0; font-size: 12px;">YOUR LOGIN CREDENTIALS</p><p style="margin: 8px 0 0; color: #F0F4FF;"><strong>Email:</strong> ${reg.owner_email}</p><p style="margin: 4px 0 0; color: #F0F4FF;"><strong>Temporary Password:</strong> ${tempPassword}</p></div><p style="color: #7C8BA0; font-size: 12px;">Please change your password after your first login.</p>${blueButton('Sign In to TruckZen', `${appUrl}/login`)}`)
    sendEmail(reg.owner_email, `Your TruckZen account is ready — ${reg.shop_name}`, welcomeHtml).catch(() => {})

    await s.from('platform_activity_log').insert({ action_type: 'shop_approved', description: `Approved registration: ${reg.shop_name} (${reg.owner_email})`, shop_id: shop.id, performed_by: actor.id, metadata: { registration_id: reg.id } })
    return NextResponse.json({ ok: true, shop_id: shop.id })
  }

  if (action === 'reject') {
    if (!rejectReason) return NextResponse.json({ error: 'reject_reason required' }, { status: 400 })
    await s.from('shop_registrations').update({ status: 'rejected', reviewed_by: actor.id, reviewed_at: new Date().toISOString(), reject_reason: rejectReason }).eq('id', registrationId)
    const rejectHtml = emailWrapper(platformShop, `<h2 style="color: #F0F4FF; margin: 0 0 8px;">Registration Update</h2><p style="color: #7C8BA0;">Thank you for your interest in TruckZen. Unfortunately, we are unable to onboard your shop <strong style="color: #F0F4FF;">${reg.shop_name}</strong> at this time.</p><div style="background: #161B24; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 16px 0;"><p style="margin: 0; color: #7C8BA0; font-size: 12px;">REASON</p><p style="margin: 8px 0 0; color: #F0F4FF;">${rejectReason}</p></div><p style="color: #7C8BA0; font-size: 12px;">If you have questions, please contact us at support@truckzen.pro.</p>`)
    sendEmail(reg.owner_email, `TruckZen Registration Update — ${reg.shop_name}`, rejectHtml).catch(() => {})
    await s.from('platform_activity_log').insert({ action_type: 'shop_rejected', description: `Rejected registration: ${reg.shop_name} — ${rejectReason}`, performed_by: actor.id, metadata: { registration_id: reg.id, reject_reason: rejectReason } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
