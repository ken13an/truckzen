// DISABLED — Security_Crash_Audit_1 finding F-03 (P0).
// GET/POST had no auth gate and accepted `shop_id` from query/body, enabling
// cross-shop read/write of compliance records. Returns 503 until actor-derived
// shop scoping lands.
import { NextResponse } from 'next/server'

function disabled() {
  return NextResponse.json(
    { error: 'Endpoint disabled pending security review. Contact admin.' },
    { status: 503 },
  )
}

export async function GET() { return disabled() }
export async function POST() { return disabled() }
