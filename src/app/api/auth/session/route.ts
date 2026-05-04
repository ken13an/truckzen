import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile } from '@/lib/server-auth'
import { randomUUID } from 'crypto'
import { safeRoute } from '@/lib/api-handler'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

// POST — called after successful login to create a session token
async function _POST() {
  const user = await getAuthenticatedUserProfile()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = randomUUID()
  const s = db()
  await s.from('users').update({
    session_token: token,
    session_updated_at: new Date().toISOString(),
  }).eq('id', user.id)

  const response = NextResponse.json({ ok: true })
  response.cookies.set('tz_session_token', token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60, // match session timeout
  })
  return response
}

// DELETE — called on logout to clear session token
async function _DELETE() {
  const user = await getAuthenticatedUserProfile()

  if (user) {
    const s = db()
    await s.from('users').update({ session_token: null, session_updated_at: null }).eq('id', user.id)
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.delete('tz_session_token')
  response.cookies.delete('tz_session_checked')
  return response
}

export const POST = safeRoute(_POST)
export const DELETE = safeRoute(_DELETE)
