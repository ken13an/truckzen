// ============================================================
// lib/supabase/client.ts — Browser client
// ============================================================

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ============================================================
// lib/supabase/server.ts — Server client (API routes, RSC)
// ============================================================
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

// ============================================================
// lib/auth.ts — Auth helpers
// ============================================================
import type { Database } from './database.types'

export type UserProfile = {
  id: string
  shop_id: string
  full_name: string
  email: string
  role: Database['public']['Enums']['user_role']
  team: string | null
  language: 'en' | 'ru' | 'uz' | 'es'
  avatar_color: string
  telegram_id: number | null
}

export async function getCurrentUser(supabase: any): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

// Role permission checks
export const UNLIMITED_ROLES = ['owner', 'gm', 'it_person'] as const
export const SHOP_ROLES = ['shop_manager', 'service_advisor', 'service_writer', 'technician', 'parts_manager'] as const
export const FLEET_ROLES = ['fleet_manager', 'maintenance_manager', 'maintenance_technician', 'dispatcher'] as const
export const FINANCE_ROLES = ['accountant', 'office_admin'] as const

export function canAccess(role: string, section: 'shop' | 'fleet' | 'accounting' | 'settings' | 'all') {
  if (UNLIMITED_ROLES.includes(role as any)) return true
  switch (section) {
    case 'shop':       return [...SHOP_ROLES, ...UNLIMITED_ROLES].includes(role as any)
    case 'fleet':      return [...FLEET_ROLES, ...UNLIMITED_ROLES].includes(role as any)
    case 'accounting': return [...FINANCE_ROLES, ...UNLIMITED_ROLES].includes(role as any)
    case 'settings':   return ['office_admin', ...UNLIMITED_ROLES].includes(role as any)
    case 'all':        return UNLIMITED_ROLES.includes(role as any)
    default:           return false
  }
}

export function isTechnician(role: string) {
  return role === 'technician' || role === 'maintenance_technician'
}

export function isUnlimited(role: string) {
  return UNLIMITED_ROLES.includes(role as any)
}
