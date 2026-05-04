import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile } from '@/lib/server-auth'
import { verifySync, generateSecret, generateURI } from 'otplib'
import * as QRCode from 'qrcode'
import { safeRoute } from '@/lib/api-handler'
import { rateLimit } from '@/lib/ratelimit/core'
import { getRequestIp } from '@/lib/ratelimit/request-ip'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

const TWO_FA_ROLES = ['owner', 'gm', 'it_person', 'accountant', 'office_admin']

async function _POST(req: Request) {
  const body = await req.json()
  const { action, code, user_id } = body

  // Validate action requires auth for setup/verify/disable
  if (action === 'validate') {
    // Validate during login — uses user_id from body (user not yet fully authenticated)
    if (!user_id || !code) return NextResponse.json({ error: 'user_id and code required' }, { status: 400 })

    // Strict brute-force protection on the unauthenticated TOTP code check.
    const ip = getRequestIp(req)
    const ipLimit = await rateLimit('2fa-validate-ip', ip)
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many 2FA attempts' }, { status: 429 })
    }
    const userLimit = await rateLimit('2fa-validate-user', String(user_id))
    if (!userLimit.allowed) {
      return NextResponse.json({ error: 'Too many 2FA attempts' }, { status: 429 })
    }

    const s = db()
    const { data: userData } = await s.from('users').select('totp_secret, totp_enabled').eq('id', user_id).single()
    if (!userData?.totp_enabled || !userData?.totp_secret) return NextResponse.json({ error: '2FA not enabled' }, { status: 400 })

    const isValid = verifySync({ token: String(code), secret: userData.totp_secret }).valid
    if (!isValid) return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 401 })
    return NextResponse.json({ ok: true })
  }

  // All other actions require authenticated session
  const user = await getAuthenticatedUserProfile()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const s = db()

  if (action === 'setup') {
    if (!TWO_FA_ROLES.includes(user.role)) return NextResponse.json({ error: 'Not available for your role' }, { status: 403 })

    const secret = generateSecret()
    const otpauth = generateURI({ secret, issuer: 'TruckZen', label: user.email ?? '' })
    const qrDataUrl = await QRCode.toDataURL(otpauth)

    await s.from('users').update({ totp_secret: secret }).eq('id', user.id)

    return NextResponse.json({ qr: qrDataUrl, secret })
  }

  if (action === 'verify') {
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

    const { data: userData } = await s.from('users').select('totp_secret').eq('id', user.id).single()
    if (!userData?.totp_secret) return NextResponse.json({ error: 'Run setup first' }, { status: 400 })

    const isValid = verifySync({ token: String(code), secret: userData.totp_secret }).valid
    if (!isValid) return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })

    await s.from('users').update({ totp_enabled: true, totp_verified_at: new Date().toISOString() }).eq('id', user.id)
    return NextResponse.json({ ok: true, enabled: true })
  }

  if (action === 'disable') {
    await s.from('users').update({ totp_enabled: false, totp_secret: null, totp_verified_at: null }).eq('id', user.id)
    return NextResponse.json({ ok: true, enabled: false })
  }

  if (action === 'status') {
    const { data: userData } = await s.from('users').select('totp_enabled, totp_verified_at').eq('id', user.id).single()
    return NextResponse.json({ enabled: userData?.totp_enabled || false, verified_at: userData?.totp_verified_at })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export const POST = safeRoute(_POST)
