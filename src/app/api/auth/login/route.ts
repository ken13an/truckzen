import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
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
    .gte('attempted_at', cutoff)

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

  // Check if user has 2FA enabled
  const { data: profile } = await s.from('users').select('role, totp_enabled').eq('id', data.user.id).single()
  const requires2FA = profile?.totp_enabled === true

  return NextResponse.json({
    ok: true,
    session: data.session,
    user: { id: data.user.id, role: profile?.role },
    requires2FA,
  })
}
