import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/ratelimit/core'
import { getRequestIp } from '@/lib/ratelimit/request-ip'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

// Simple rate limiter: IP → { count, resetAt }
const attempts = new Map<string, { count: number; resetAt: number; lockedUntil: number }>()

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')?.toLowerCase().trim()
  const pin = searchParams.get('pin')?.trim()

  if (!code || !pin) return NextResponse.json({ error: 'code and pin required' }, { status: 400 })

  // Strict per-IP cap on the PIN brute-force surface (outer cap; durable).
  const ip = getRequestIp(req)
  const ipLimit = await rateLimit('kiosk-pin-ip', ip)
  if (!ipLimit.allowed) {
    return NextResponse.json({ valid: false, error: 'Too many kiosk attempts' }, { status: 429 })
  }
  const key = `${ip}:${code}`
  const now = Date.now()
  const entry = attempts.get(key)

  // Check lock
  if (entry && entry.lockedUntil > now) {
    const secsLeft = Math.ceil((entry.lockedUntil - now) / 1000)
    return NextResponse.json({ valid: false, locked: true, retry_after: secsLeft }, { status: 429 })
  }

  // Reset counter if window expired
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 0, resetAt: now + 60000, lockedUntil: 0 })
  }

  const current = attempts.get(key)!
  if (current.count >= 10) {
    return NextResponse.json({ valid: false, error: 'Too many attempts' }, { status: 429 })
  }

  const s = db()
  const { data: shop } = await s.from('shops')
    .select('kiosk_pin')
    .eq('kiosk_code', code)
    .single()

  if (!shop) return NextResponse.json({ valid: false, error: 'Kiosk not found' }, { status: 404 })

  const valid = shop.kiosk_pin === pin

  current.count++
  if (!valid && current.count >= 5) {
    // Lock for 5 minutes after 5 wrong attempts
    current.lockedUntil = now + 5 * 60 * 1000
  }

  return NextResponse.json({ valid })
}
