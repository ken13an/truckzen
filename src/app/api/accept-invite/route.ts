import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { rateLimit } from '@/lib/ratelimit/core'
import { getRequestIp } from '@/lib/ratelimit/request-ip'

const ALLOWED_LANGUAGES = ['en', 'ru', 'uz', 'es']

async function checkInviteLimits(req: Request, token: string) {
  const ip = getRequestIp(req)
  const ipLimit = await rateLimit('accept-invite-ip', ip)
  if (!ipLimit.allowed) return false
  if (token) {
    const tokenLimit = await rateLimit('accept-invite-token', token)
    if (!tokenLimit.allowed) return false
  }
  return true
}

type InviteRow = {
  id: string
  email: string
  full_name: string | null
  language: string | null
  invite_expires_at: string | null
  invite_accepted_at: string | null
}

async function lookupInvite(token: string): Promise<
  | { ok: true; user: InviteRow }
  | { ok: false; status: number; code: 'missing' | 'invalid' | 'expired' | 'used'; message: string }
> {
  if (!token || typeof token !== 'string') {
    return { ok: false, status: 400, code: 'missing', message: 'Invitation token missing.' }
  }
  const s = createAdminSupabaseClient()
  const { data } = await s
    .from('users')
    .select('id, email, full_name, language, invite_expires_at, invite_accepted_at')
    .eq('invite_token', token)
    .maybeSingle()
  if (!data) return { ok: false, status: 404, code: 'invalid', message: 'This invitation link is invalid. Please request a new invitation from your administrator.' }
  const user = data as InviteRow
  if (user.invite_accepted_at) return { ok: false, status: 410, code: 'used', message: 'This invitation has already been accepted. Please sign in with your password.' }
  if (user.invite_expires_at && Date.parse(user.invite_expires_at) < Date.now()) {
    return { ok: false, status: 410, code: 'expired', message: 'This invitation has expired. Please request a new invitation from your administrator.' }
  }
  return { ok: true, user }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') || ''
  if (!(await checkInviteLimits(req, token))) {
    return NextResponse.json({ error: 'Too many invite attempts' }, { status: 429 })
  }
  const result = await lookupInvite(token)
  if (!result.ok) return NextResponse.json({ error: result.message, code: result.code }, { status: result.status })
  return NextResponse.json({
    email: result.user.email,
    full_name: result.user.full_name || '',
    language: result.user.language || 'en',
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!(await checkInviteLimits(req, token))) {
    return NextResponse.json({ error: 'Too many invite attempts' }, { status: 429 })
  }
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  const language = typeof body?.language === 'string' ? body.language.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!fullName) return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 })
  if (!ALLOWED_LANGUAGES.includes(language)) return NextResponse.json({ error: 'Please choose a supported language.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

  const result = await lookupInvite(token)
  if (!result.ok) return NextResponse.json({ error: result.message, code: result.code }, { status: result.status })

  const s = createAdminSupabaseClient()
  const { error: pwErr } = await s.auth.admin.updateUserById(result.user.id, { password })
  if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 })

  const { error: profileErr } = await s
    .from('users')
    .update({
      full_name: fullName,
      language,
      invite_accepted_at: new Date().toISOString(),
      invite_token: null,
      invite_expires_at: null,
    })
    .eq('id', result.user.id)
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, email: result.user.email })
}
