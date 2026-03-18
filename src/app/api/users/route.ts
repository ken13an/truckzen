import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/integrations/resend'
import { log } from '@/lib/security'

function getSupabaseAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(_req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mgmtRoles = ['owner','gm','it_person','shop_manager','office_admin']
  if (!mgmtRoles.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, team, language, telegram_id, active, created_at')
    .eq('shop_id', user.shop_id)
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mgmtRoles = ['owner','gm','it_person','shop_manager','office_admin']
  if (!mgmtRoles.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const { full_name, email, role, team, language } = body
  if (!full_name || !email || !role) return NextResponse.json({ error: 'full_name, email, role required' }, { status: 400 })

  // Create Supabase auth user
  const { data: auth, error: authErr } = await getSupabaseAdmin().auth.admin.createUser({
    email: email.toLowerCase().trim(),
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (authErr || !auth.user) {
    return NextResponse.json({ error: authErr?.message || 'Failed to create auth user' }, { status: 500 })
  }

  // Get shop info
  const { data: shop } = await supabase.from('shops').select('name, dba').eq('id', user.shop_id).single()
  const shopName = (shop as any)?.dba || (shop as any)?.name || 'TruckZen'

  // Insert user profile
  const { data: profile, error: profileErr } = await supabase.from('users').insert({
    id:       auth.user.id,
    shop_id:  user.shop_id,
    full_name: full_name.trim(),
    email:    email.toLowerCase().trim(),
    role,
    team:     team || null,
    language: language || 'en',
    active:   true,
  }).select().single()

  if (profileErr) {
    await getSupabaseAdmin().auth.admin.deleteUser(auth.user.id)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // Send welcome email
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`
  await sendWelcomeEmail(email, full_name, shopName, loginUrl)

  await log('user.created', user.shop_id, user.id, { table:'users', recordId: auth.user.id, newData:{ full_name, email, role } })
  return NextResponse.json(profile, { status: 201 })
}
