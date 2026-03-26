// src/lib/auth.ts
import { type SupabaseClient } from '@supabase/supabase-js'

export interface UserProfile {
  id:        string
  shop_id:   string
  full_name: string
  email:     string
  role:      string
  team:      string | null
  language:  string
  telegram_id: string | null
  active:    boolean
  can_create_so: boolean
  can_impersonate: boolean
  impersonate_role: string | null
  is_platform_owner?: boolean
}

export async function getCurrentUser(supabase: SupabaseClient): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, shop_id, full_name, email, role, team, language, telegram_id, active, can_create_so, can_impersonate, impersonate_role, is_platform_owner')
    .eq('id', user.id)
    .single()

  // If RLS blocks the query, try fetching minimal info from auth metadata
  if (error || !profile) {
    // Fallback: return basic profile from auth user metadata
    return null
  }

  if (!profile.active) return null
  return profile as UserProfile
}

export const UNLIMITED_ROLES = ['owner', 'gm', 'it_person']
export const MANAGEMENT_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'office_admin']

export function canAccess(role: string, allowedRoles: string[]): boolean {
  if (UNLIMITED_ROLES.includes(role)) return true
  return allowedRoles.includes(role)
}
