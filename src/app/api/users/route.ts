import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/integrations/resend'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data, error } = await s.from('users')
    .select('id, full_name, email, role, team, language, telegram_id, active, can_create_so, can_impersonate, created_at')
    .eq('shop_id', shopId)
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { shop_id, user_id, full_name, email, role, team, language } = body

  if (!full_name || !email || !role) return NextResponse.json({ error: 'full_name, email, role required' }, { status: 400 })

  // Determine shop_id — from body or look up from user_id
  let shopId = shop_id
  if (!shopId && user_id) {
    const { data: caller } = await s.from('users').select('shop_id, role').eq('id', user_id).single()
    if (!caller) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    shopId = caller.shop_id

    // Permission check — only management roles can invite
    const mgmtRoles = ['owner', 'gm', 'it_person', 'shop_manager', 'office_admin']
    if (!mgmtRoles.includes(caller.role)) {
      return NextResponse.json({ error: 'Access denied — only management can invite staff' }, { status: 403 })
    }
  }

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  // Create auth user with temporary password
  const tempPassword = `TZ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const { data: auth, error: authErr } = await s.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (authErr || !auth.user) {
    return NextResponse.json({ error: authErr?.message || 'Failed to create auth user' }, { status: 500 })
  }

  // Determine can_create_so default
  const canCreateSo = ['owner', 'gm', 'it_person', 'service_writer'].includes(role)

  // Insert user profile
  const { data: profile, error: profileErr } = await s.from('users').insert({
    id: auth.user.id,
    shop_id: shopId,
    full_name: full_name.trim(),
    email: email.toLowerCase().trim(),
    role,
    team: team || null,
    language: language || 'en',
    active: true,
    can_create_so: canCreateSo,
  }).select().single()

  if (profileErr) {
    // Rollback: delete auth user if profile insert fails
    await s.auth.admin.deleteUser(auth.user.id)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // Send welcome email
  try {
    const { data: shop } = await s.from('shops').select('name, dba').eq('id', shopId).single()
    const shopName = shop?.dba || shop?.name || 'TruckZen'
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/login`
    await sendWelcomeEmail(email, full_name, shopName, loginUrl)
  } catch {}

  return NextResponse.json(profile, { status: 201 })
}
