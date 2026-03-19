import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/impersonate — set or clear impersonation role
export async function POST(req: Request) {
  const s = db()
  const { user_id, role } = await req.json()

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Verify user can impersonate
  const { data: user } = await s.from('users').select('can_impersonate, role').eq('id', user_id).single()
  if (!user?.can_impersonate) return NextResponse.json({ error: 'Not authorized to impersonate' }, { status: 403 })

  // Set or clear impersonate_role
  const newRole = role === user.role || role === 'reset' || !role ? null : role
  await s.from('users').update({ impersonate_role: newRole }).eq('id', user_id)

  return NextResponse.json({ ok: true, impersonate_role: newRole, actual_role: user.role })
}
