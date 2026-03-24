import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', userId).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  // Get all autobot users
  const { data: autobotUsers } = await s.from('users').select('id, email').eq('is_autobot', true)

  if (autobotUsers && autobotUsers.length > 0) {
    // Delete from auth
    for (const u of autobotUsers) {
      try {
        await s.auth.admin.deleteUser(u.id)
      } catch {}
    }

    // Delete from users table
    await s.from('users').delete().eq('is_autobot', true)
  }

  // Reset autobots table
  await s.from('autobots').update({
    status: 'inactive',
    auth_user_id: null,
    deployed_at: null,
  }).neq('id', '00000000-0000-0000-0000-000000000000') // update all

  // Log activity
  await s.from('platform_activity_log').insert({
    action_type: 'autobots_reset',
    description: `Reset all AutoBots — removed ${autobotUsers?.length || 0} accounts`,
    performed_by: userId,
  })

  return NextResponse.json({ ok: true, removed: autobotUsers?.length || 0 })
}
