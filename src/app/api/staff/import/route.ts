import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/integrations/resend'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const VALID_ROLES = [
  'technician', 'maintenance_technician', 'maintenance_manager',
  'service_writer', 'accountant', 'office_admin', 'shop_manager', 'gm',
  'parts_manager', 'fleet_manager', 'dispatcher', 'driver', 'owner',
]

export async function POST(req: Request) {
  const s = db()
  const { employees, shopId } = await req.json()

  if (!employees?.length || !shopId) {
    return NextResponse.json({ error: 'Missing employees or shopId' }, { status: 400 })
  }

  // Get shop name for welcome emails
  const { data: shop } = await s.from('shops').select('name, dba').eq('id', shopId).single()
  const shopName = shop?.dba || shop?.name || 'TruckZen'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'

  const results = []

  for (const emp of employees) {
    try {
      const email = emp.email?.toLowerCase().trim()
      const role = emp.role?.trim()
      const language = emp.language?.trim() || 'en'
      const team = emp.team?.trim() || null
      const fullName = emp.full_name?.trim()

      if (!email || !fullName || !role) {
        results.push({ email, name: fullName, status: 'error', reason: 'Missing required fields' })
        continue
      }

      if (!VALID_ROLES.includes(role)) {
        results.push({ email, name: fullName, status: 'error', reason: `Invalid role: ${role}` })
        continue
      }

      // Check if user already exists in this shop
      const { data: existing } = await s
        .from('users')
        .select('id')
        .eq('email', email)
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .single()

      if (existing) {
        results.push({ email, name: fullName, status: 'skipped', reason: 'Already exists in this shop' })
        continue
      }

      // Create Supabase auth account with temporary password
      const tempPassword = `TZ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const { data: auth, error: authErr } = await s.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

      if (authErr) {
        if (authErr.message?.includes('already been registered') || authErr.message?.includes('already registered')) {
          results.push({ email, name: fullName, status: 'skipped', reason: 'Email already registered in auth' })
          continue
        }
        results.push({ email, name: fullName, status: 'error', reason: authErr.message })
        continue
      }

      if (!auth?.user) {
        results.push({ email, name: fullName, status: 'error', reason: 'Auth user creation returned no user' })
        continue
      }

      // Determine can_create_so default
      const canCreateSo = ['owner', 'gm', 'service_writer'].includes(role)

      // Create user record in users table
      const { error: userError } = await s.from('users').insert({
        id: auth.user.id,
        email,
        full_name: fullName,
        role,
        shop_id: shopId,
        team,
        language,
        active: true,
        can_create_so: canCreateSo,
        skills: emp.skills ? emp.skills.split(',').map((sk: string) => sk.trim()).filter(Boolean) : [],
      })

      if (userError) {
        // Rollback: delete auth user if profile insert fails
        await s.auth.admin.deleteUser(auth.user.id)
        results.push({ email, name: fullName, status: 'error', reason: userError.message })
        continue
      }

      // Add mechanic_skills rows for technicians
      if (['technician', 'maintenance_technician'].includes(role) && emp.skills) {
        const skillsList = emp.skills.split(',').map((sk: string) => sk.trim()).filter(Boolean)
        for (const skill of skillsList) {
          await s.from('mechanic_skills').insert({
            user_id: auth.user.id,
            shop_id: shopId,
            skill_name: skill,
            skill_category: 'general',
            experience_level: 'intermediate',
          }).then(() => {}) // ignore dupes
        }
      }

      // Generate password reset link and send welcome email
      try {
        const { data: linkData } = await s.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: `${appUrl}/reset-password` },
        })
        const setupUrl = linkData?.properties?.action_link || `${appUrl}/forgot-password`
        await sendWelcomeEmail(email, fullName, shopName, setupUrl)
      } catch (emailErr) {
        console.error(`[Staff Import] Failed to send welcome email to ${email}:`, emailErr)
      }

      results.push({ email, name: fullName, status: 'created', reason: 'Account created, welcome email sent' })

    } catch (err: any) {
      results.push({ email: emp.email, name: emp.full_name, status: 'error', reason: err.message })
    }
  }

  const summary = {
    total: employees.length,
    created: results.filter(r => r.status === 'created').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    failed: results.filter(r => r.status === 'error').length,
    results,
  }

  return NextResponse.json(summary)
}
