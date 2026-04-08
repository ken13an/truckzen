import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.is_platform_owner) return jsonError('Access denied', 403)

  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()

  const { data: bots, error } = await s.from('autobots').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!bots || bots.length === 0) return NextResponse.json({ error: 'No autobots found' }, { status: 404 })

  const results: any[] = []

  for (const bot of bots) {
    try {
      const { data: { users: existing } } = await s.auth.admin.listUsers()
      const found = existing?.find((u: any) => u.email === bot.email)

      let authUserId: string

      if (found) {
        authUserId = found.id
      } else {
        const { data: auth, error: authErr } = await s.auth.admin.createUser({
          email: bot.email, password: crypto.randomUUID() + crypto.randomUUID(),
          email_confirm: true, user_metadata: { full_name: bot.name },
        })
        if (authErr || !auth.user) {
          results.push({ name: bot.name, status: 'error', error: authErr?.message || 'Failed to create auth user' })
          continue
        }
        authUserId = auth.user.id
      }

      const { data: existingProfile } = await s.from('users').select('id').eq('id', authUserId).single()

      if (!existingProfile) {
        await s.from('users').insert({
          id: authUserId, shop_id: shopId, full_name: bot.name,
          email: bot.email, role: bot.role, language: 'en', active: true, is_autobot: true,
        })
      } else {
        await s.from('users').update({ is_autobot: true, active: true }).eq('id', authUserId)
      }

      await s.from('autobots').update({
        status: 'active', auth_user_id: authUserId, deployed_at: new Date().toISOString(),
      }).eq('id', bot.id)

      results.push({ name: bot.name, status: 'deployed', auth_user_id: authUserId })
    } catch (err: any) {
      results.push({ name: bot.name, status: 'error', error: err.message })
    }
  }

  await s.from('platform_activity_log').insert({
    action_type: 'autobots_deployed',
    description: `Deployed ${results.filter(r => r.status === 'deployed').length} AutoBots`,
    performed_by: actor.id,
  })

  return NextResponse.json({ results })
}
