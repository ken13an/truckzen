import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const start = Date.now()
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await db.from('shops').select('id', { count: 'exact', head: true }).limit(1)
    const latency = Date.now() - start
    if (error) return NextResponse.json({ status: 'degraded', db: 'error', error: error.message, latency_ms: latency }, { status: 503 })
    return NextResponse.json({ status: 'ok', db: 'connected', latency_ms: latency })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', db: 'unreachable', error: e.message, latency_ms: Date.now() - start }, { status: 503 })
  }
}
