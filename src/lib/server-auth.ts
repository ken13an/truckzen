import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export type AuthenticatedUser = {
  id: string
  shop_id: string | null
  full_name: string | null
  email: string | null
  role: string
  team?: string | null
  language?: string | null
  telegram_id?: string | null
  active: boolean
  can_create_so?: boolean
  can_impersonate?: boolean
  impersonate_role?: string | null
  is_platform_owner?: boolean
  deleted_at?: string | null
  effective_shop_id?: string | null
  platform_impersonation?: {
    active?: boolean
    target_shop_id?: string | null
    target_shop_name?: string | null
    started_at?: string | null
  } | null
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export async function createRequestSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

export function createAdminSupabaseClient(): SupabaseClient {
  return createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  )
}

export async function getAuthenticatedUserProfile(): Promise<AuthenticatedUser | null> {
  const requestClient = await createRequestSupabaseClient()
  const {
    data: { user },
  } = await requestClient.auth.getUser()

  if (!user) return null

  const adminClient = createAdminSupabaseClient()
  const { data: authUser } = await adminClient.auth.admin.getUserById(user.id)
  const impersonation = authUser.user?.app_metadata?.platform_impersonation || null
  let effectiveImpersonation = impersonation

  // F-19 session-level revoke enforcement: if a session claims active
  // impersonation, verify the ACL row is still present and un-revoked. If not,
  // clear metadata using the same canonical path as /stop and proceed as a
  // non-impersonating actor for this request.
  if (impersonation?.active && impersonation?.target_shop_id) {
    const { data: acl } = await adminClient
      .from('platform_impersonation_acl')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('shop_id', impersonation.target_shop_id)
      .is('revoked_at', null)
      .maybeSingle()
    if (!acl) {
      const currentMeta = authUser.user?.app_metadata || {}
      const nextMetadata = { ...currentMeta }
      delete (nextMetadata as any).platform_impersonation
      try {
        await adminClient.auth.admin.updateUserById(user.id, { app_metadata: nextMetadata })
      } catch (e) {
        console.error('[acl-enforce] Failed to clear impersonation metadata', e)
      }
      effectiveImpersonation = null
    }
  }

  const { data: profile } = await adminClient
    .from('users')
    .select('id, shop_id, full_name, email, role, team, language, telegram_id, active, can_create_so, can_impersonate, impersonate_role, is_platform_owner, deleted_at')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.active || profile.deleted_at) return null

  return {
    ...(profile as AuthenticatedUser),
    effective_shop_id: effectiveImpersonation?.active ? effectiveImpersonation?.target_shop_id || null : profile.shop_id,
    platform_impersonation: effectiveImpersonation?.active ? effectiveImpersonation : null,
  }
}

export function getActorShopId(actor: AuthenticatedUser): string | null {
  return actor.effective_shop_id || actor.shop_id || null
}

export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export function requireRoles(actor: AuthenticatedUser, allowedRoles: string[]): string | null {
  // Platform owner not impersonating → always allowed
  if (actor.is_platform_owner && !actor.impersonate_role) return null
  // Use effective role (impersonated or real)
  const effectiveRole = actor.impersonate_role || actor.role
  return allowedRoles.includes(effectiveRole) ? null : 'Forbidden'
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
