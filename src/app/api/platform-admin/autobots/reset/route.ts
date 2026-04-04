import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.is_platform_owner) return jsonError('Access denied', 403)

  const s = createAdminSupabaseClient()

  const { data: autobotUsers } = await s.from('users').select('id, email').eq('is_autobot', true)

  if (autobotUsers && autobotUsers.length > 0) {
    for (const u of autobotUsers) {
      try { await s.auth.admin.deleteUser(u.id) } catch {}
    }
    await s.from('users').delete().eq('is_autobot', true)
  }

  await s.from('autobots').update({
    status: 'inactive', auth_user_id: null, deployed_at: null,
  }).neq('id', '00000000-0000-0000-0000-000000000000')

  await s.from('platform_activity_log').insert({
    action_type: 'autobots_reset',
    description: `Reset all AutoBots — removed ${autobotUsers?.length || 0} accounts`,
    performed_by: actor.id,
  })

  return NextResponse.json({ ok: true, removed: autobotUsers?.length || 0 })
}
