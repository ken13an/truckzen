import { NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/integrations/resend'
import { getActorShopId } from '@/lib/server-auth'
import { MANAGEMENT_ROLES } from '@/lib/roles'
import { requireManagementContext, requireRouteContext } from '@/lib/api-route-auth'

function managementError() { return NextResponse.json({ error: 'Access denied — only management can manage staff' }, { status: 403 }) }

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { searchParams } = new URL(req.url)
  const requestedShopId = searchParams.get('shop_id')
  const shopId = ctx.actor.is_platform_owner && requestedShopId ? requestedShopId : getActorShopId(ctx.actor)
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data, error } = await ctx.admin.from('users')
    .select('id, full_name, email, role, team, language, telegram_id, active, can_create_so, can_impersonate, is_platform_owner, impersonate_role, created_at, deleted_at, skills, availability')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .or('is_autobot.is.null,is_autobot.eq.false')
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const safeData = (data || []).filter((u: any) => ctx.actor.is_platform_owner || !u.is_platform_owner)
  if (safeData.length > 0) {
    const { data: authPage } = await ctx.admin.auth.admin.listUsers({ perPage: 1000 })
    const authMap: Record<string, string | null> = {}
    for (const au of authPage?.users || []) authMap[au.id] = au.last_sign_in_at || null
    for (const u of safeData as any[]) u.last_sign_in_at = authMap[u.id] || null
  }

  return NextResponse.json(safeData)
}

export async function POST(req: Request) {
  const ctx = await requireManagementContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!

  const body = await req.json().catch(() => null)
  const { shop_id, full_name, email, role, team, language } = body || {}
  if (!full_name || !email || !role) return NextResponse.json({ error: 'full_name, email, role required' }, { status: 400 })

  const shopId = ctx.actor.is_platform_owner && shop_id ? shop_id : getActorShopId(ctx.actor)
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!MANAGEMENT_ROLES.includes(ctx.actor.role) && !ctx.actor.is_platform_owner) return managementError()

  const normalizedEmail = email.toLowerCase().trim()
  const { data: existingProfile } = await ctx.admin.from('users').select('id, email').eq('email', normalizedEmail).single()
  if (existingProfile) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
    try {
      const { data: linkData } = await ctx.admin.auth.admin.generateLink({ type: 'recovery', email: normalizedEmail, options: { redirectTo: `${appUrl}/reset-password` } })
      const setupUrl = linkData?.properties?.action_link || `${appUrl}/forgot-password`
      await sendWelcomeEmail(email, full_name, 'TruckZen', setupUrl)
    } catch {}
    return NextResponse.json({ ...existingProfile, resent: true }, { status: 200 })
  }

  const tempPassword = `TZ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const { data: auth, error: authErr } = await ctx.admin.auth.admin.createUser({
    email: normalizedEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name },
  })
  if (authErr || !auth.user) return NextResponse.json({ error: authErr?.message || 'Failed to create auth user' }, { status: 500 })

  const canCreateSo = ['owner', 'gm', 'it_person', 'service_writer'].includes(role)
  const { data: profile, error: profileErr } = await ctx.admin.from('users').insert({
    id: auth.user.id,
    shop_id: shopId,
    full_name: full_name.trim(),
    email: normalizedEmail,
    role,
    team: team || null,
    language: language || 'en',
    active: true,
    can_create_so: canCreateSo,
  }).select().single()

  if (profileErr) {
    await ctx.admin.auth.admin.deleteUser(auth.user.id)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  try {
    const { data: shop } = await ctx.admin.from('shops').select('name, dba').eq('id', shopId).single()
    const shopName = shop?.dba || shop?.name || 'TruckZen'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
    const { data: linkData } = await ctx.admin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo: `${appUrl}/reset-password` },
    })
    const setupUrl = linkData?.properties?.action_link || `${appUrl}/forgot-password`
    await sendWelcomeEmail(email, full_name, shopName, setupUrl)
  } catch (emailErr) {
    console.error('[Users] Failed to send invite email:', emailErr)
  }

  return NextResponse.json(profile, { status: 201 })
}
