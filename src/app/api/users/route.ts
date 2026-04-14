import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sendWelcomeEmail } from '@/lib/integrations/resend'
import { getActorShopId } from '@/lib/server-auth'
import { MANAGEMENT_ROLES } from '@/lib/roles'
import { requireManagementContext, requireRouteContext } from '@/lib/api-route-auth'

const INVITE_EXPIRY_DAYS = 7
function newInviteToken() { return randomBytes(32).toString('base64url') }
function inviteExpiry() { return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString() }

function managementError() { return NextResponse.json({ error: 'Access denied — only management can manage staff' }, { status: 403 }) }

async function findAuthUserByEmail(admin: any, email: string): Promise<{ id: string; email: string } | null> {
  // Supabase admin has no direct "getUserByEmail"; scan paged list. 1000/page is the max;
  // this set is small and this runs only on invite creation (rare).
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data) return null
    const match = (data.users || []).find((u: any) => (u.email || '').toLowerCase() === email)
    if (match) return { id: match.id, email: match.email }
    if (!data.users || data.users.length < 1000) return null
    page += 1
    if (page > 20) return null
  }
}

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
  if (!MANAGEMENT_ROLES.includes(ctx.actor.impersonate_role || ctx.actor.role) && !(ctx.actor.is_platform_owner && !ctx.actor.impersonate_role)) return managementError()

  const normalizedEmail = email.toLowerCase().trim()

  // ── Canonical lookup: all public.users rows for this email, across shops ──
  const { data: existingRows, error: lookupErr } = await ctx.admin
    .from('users')
    .select('id, email, shop_id, role, active, invite_accepted_at, deleted_at')
    .eq('email', normalizedEmail)
  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 })

  const liveRows = (existingRows || []).filter((r: any) => !r.deleted_at)

  // Case 5: >1 canonical row for same email → stop with duplicate report.
  if (liveRows.length > 1) {
    return NextResponse.json({
      error: 'Duplicate profile rows exist for this email. Please reconcile before inviting.',
      code: 'duplicate_profiles',
      rows: liveRows.map((r: any) => ({ id: r.id, shop_id: r.shop_id, role: r.role, active: r.active, accepted: !!r.invite_accepted_at })),
    }, { status: 409 })
  }

  // Case 3 + Case 2: one existing canonical row.
  if (liveRows.length === 1) {
    const row = liveRows[0]
    if (row.invite_accepted_at) {
      return NextResponse.json({
        error: 'An active account already exists for this email.',
        code: 'already_active',
        user: { id: row.id, shop_id: row.shop_id, role: row.role },
      }, { status: 409 })
    }
    // Case 2: pending invite — rotate token, resend.
    const token = newInviteToken()
    const expiresAt = inviteExpiry()
    const { error: updErr } = await ctx.admin.from('users')
      .update({ invite_token: token, invite_expires_at: expiresAt, invite_accepted_at: null })
      .eq('id', row.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    try {
      const { data: shop } = await ctx.admin.from('shops').select('name, dba').eq('id', row.shop_id).single()
      const shopName = shop?.dba || shop?.name || 'TruckZen'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
      await sendWelcomeEmail(email, full_name, shopName, `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`)
    } catch {}
    return NextResponse.json({ id: row.id, email: row.email, shop_id: row.shop_id, resent: true }, { status: 200 })
  }

  // No public.users row. Case 4: check auth.users for orphan before createUser.
  const existingAuth = await findAuthUserByEmail(ctx.admin, normalizedEmail)
  if (existingAuth) {
    return NextResponse.json({
      error: 'An authentication account already exists for this email but has no profile. Please reconcile before inviting.',
      code: 'auth_orphan',
      auth_user_id: existingAuth.id,
    }, { status: 409 })
  }

  // Case 1: clean create path.
  const tempPassword = `TZ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const { data: auth, error: authErr } = await ctx.admin.auth.admin.createUser({
    email: normalizedEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name },
  })
  if (authErr || !auth.user) return NextResponse.json({ error: authErr?.message || 'Failed to create auth user' }, { status: 500 })

  const canCreateSo = ['owner', 'gm', 'it_person', 'service_writer'].includes(role)
  const inviteToken = newInviteToken()
  const inviteExpiresAt = inviteExpiry()
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
    invite_token: inviteToken,
    invite_expires_at: inviteExpiresAt,
  }).select().single()

  if (profileErr) {
    await ctx.admin.auth.admin.deleteUser(auth.user.id)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  try {
    const { data: shop } = await ctx.admin.from('shops').select('name, dba').eq('id', shopId).single()
    const shopName = shop?.dba || shop?.name || 'TruckZen'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'
    const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(inviteToken)}`
    await sendWelcomeEmail(email, full_name, shopName, acceptUrl)
  } catch (emailErr) {
    console.error('[Users] Failed to send invite email:', emailErr)
  }

  return NextResponse.json(profile, { status: 201 })
}
