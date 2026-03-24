import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const SHOP_ID = '1f927e3e-4fe5-431a-bb7c-dac77501e892'

export async function POST(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', userId).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  // Get all autobots
  const { data: bots, error } = await s.from('autobots').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!bots || bots.length === 0) return NextResponse.json({ error: 'No autobots found' }, { status: 404 })

  const results: any[] = []

  for (const bot of bots) {
    try {
      // Check if auth user already exists
      const { data: { users: existing } } = await s.auth.admin.listUsers()
      const found = existing?.find((u: any) => u.email === bot.email)

      let authUserId: string

      if (found) {
        authUserId = found.id
      } else {
        // Create Supabase Auth user
        const { data: auth, error: authErr } = await s.auth.admin.createUser({
          email: bot.email,
          password: 'AutoBot2026!',
          email_confirm: true,
          user_metadata: { full_name: bot.name },
        })

        if (authErr || !auth.user) {
          results.push({ name: bot.name, status: 'error', error: authErr?.message || 'Failed to create auth user' })
          continue
        }
        authUserId = auth.user.id
      }

      // Check if users table entry exists
      const { data: existingProfile } = await s.from('users').select('id').eq('id', authUserId).single()

      if (!existingProfile) {
        // Insert into users table
        await s.from('users').insert({
          id: authUserId,
          shop_id: SHOP_ID,
          full_name: bot.name,
          email: bot.email,
          role: bot.role,
          language: 'en',
          active: true,
          is_autobot: true,
        })
      } else {
        // Update existing entry
        await s.from('users').update({ is_autobot: true, active: true }).eq('id', authUserId)
      }

      // Update autobots table
      await s.from('autobots').update({
        status: 'active',
        auth_user_id: authUserId,
        deployed_at: new Date().toISOString(),
      }).eq('id', bot.id)

      results.push({ name: bot.name, status: 'deployed', auth_user_id: authUserId })
    } catch (err: any) {
      results.push({ name: bot.name, status: 'error', error: err.message })
    }
  }

  // Log activity
  await s.from('platform_activity_log').insert({
    action_type: 'autobots_deployed',
    description: `Deployed ${results.filter(r => r.status === 'deployed').length} AutoBots`,
    performed_by: userId,
  })

  return NextResponse.json({ results })
}
