import { NextResponse } from 'next/server'
import { testConnection } from '@/lib/fullbay/client'

export async function GET() {
  if (!process.env.FULLBAY_API_KEY) {
    return NextResponse.json({ ok: false, error: 'FULLBAY_API_KEY not configured' })
  }
  const result = await testConnection()
  return NextResponse.json(result)
}
