// DISABLED — Security_Crash_Audit_1 finding F-05 (P0).
// This route had no auth gate and trusted `body.shopId` to create users with
// body-supplied roles (including 'owner'), allowing cross-shop takeover.
// Returns 503 until actor + shop-scope + role-minimum guards land.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint disabled pending security review. Contact admin.' },
    { status: 503 },
  )
}
