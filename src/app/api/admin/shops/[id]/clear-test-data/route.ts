// DISABLED — Security_Crash_Audit_1 finding F-04 (P0).
// This route verified platform-owner status using `body.user_id` (attacker-controlled),
// allowing any caller to supply a real platform-owner's id and trigger destructive
// shop data wipes. Returns 503 until the caller identity check is moved to
// getAuthenticatedUserProfile() with a real session gate.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint disabled pending security review. Contact admin.' },
    { status: 503 },
  )
}
