import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { safeRoute } from '@/lib/api-handler'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function _POST(req: Request) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const s = db()

  // ── Check lockout ──────────────────────────────────────────
  const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString()
  const { data: recentFailures } = await s
    .from('login_attempts')
    .select('id')
    .eq('email', normalizedEmail)
    .eq('success', false)
    .gte('created_at', cutoff)

  const failCount = recentFailures?.length ?? 0

  if (failCount >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` },
      { status: 429 }
    )
  }

  // ── Attempt login via Supabase Auth ────────────────────────
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error: authError } = await authClient.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (authError || !data.user) {
    // Record failed attempt
    await s.from('login_attempts').insert({
      email: normalizedEmail,
      success: false,
      ip_address: ip,
    })

    const newFailCount = failCount + 1
    const remaining = MAX_ATTEMPTS - newFailCount

    if (remaining <= 0) {
      return NextResponse.json(
        { error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: 'Incorrect email or password.',
        remaining,
      },
      { status: 401 }
    )
  }

  // ── Canonical profile / orphan enforcement ─────────────────
  // Auth-only users (no matching public.users row) must NOT receive a session —
  // role/shop_id cannot be safely derived, so they would enter the app as
  // half-users invisible to team truth. Block deterministically.
  const { data: profileRows, error: profileLookupErr } = await s
    .from('users')
    .select('id, role, shop_id, active, deleted_at, totp_enabled, is_platform_owner')
    .eq('id', data.user.id)
  if (profileLookupErr) {
    return NextResponse.json({ error: 'Sign-in temporarily unavailable. Please try again.' }, { status: 500 })
  }
  const liveProfiles = (profileRows || []).filter((p: any) => !p.deleted_at)
  if (liveProfiles.length === 0) {
    return NextResponse.json(
      { error: 'Your account setup is incomplete. Please contact your administrator.', code: 'auth_orphan' },
      { status: 403 }
    )
  }
  if (liveProfiles.length > 1) {
    return NextResponse.json(
      { error: 'Duplicate account records exist for this user. Please contact your administrator.', code: 'duplicate_profile' },
      { status: 403 }
    )
  }
  const profile = liveProfiles[0]
  if (profile.active === false) {
    return NextResponse.json(
      { error: 'This account has been deactivated. Please contact your administrator.', code: 'account_inactive' },
      { status: 403 }
    )
  }
  if (!profile.is_platform_owner && !profile.shop_id) {
    return NextResponse.json(
      { error: 'Your account is not linked to a shop. Please contact your administrator.', code: 'broken_profile' },
      { status: 403 }
    )
  }

  // ── Login succeeded ────────────────────────────────────────
  // Record success and clear failed attempts for this email
  await s.from('login_attempts').insert({
    email: normalizedEmail,
    success: true,
    ip_address: ip,
  })

  // Delete old failed attempts for this email (keep table clean)
  await s
    .from('login_attempts')
    .delete()
    .eq('email', normalizedEmail)
    .eq('success', false)

  const requires2FA = profile.totp_enabled === true

  return NextResponse.json({
    ok: true,
    session: data.session,
    user: { id: data.user.id, role: profile.role },
    requires2FA,
  })
}

export const POST = safeRoute(_POST)
