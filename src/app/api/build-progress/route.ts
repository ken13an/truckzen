// DISABLED — Security_Crash_Audit_1 finding F-01 (P0).
// GET + PATCH had no auth gate and ran against the service-role DB client,
// letting any internet caller read and mutate platform phase-completion state.
// Returns 503 until a platform-owner session gate lands.
import { NextResponse } from 'next/server'

function disabled() {
  return NextResponse.json(
    { error: 'Endpoint disabled pending security review. Contact admin.' },
    { status: 503 },
  )
}

export async function GET() { return disabled() }
export async function PATCH() { return disabled() }
