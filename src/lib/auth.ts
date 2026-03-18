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
}

export async function getCurrentUser(supabase: SupabaseClient): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, shop_id, full_name, email, role, team, language, telegram_id, active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.active) return null
  return profile as UserProfile
}

export const UNLIMITED_ROLES = ['owner', 'gm', 'it_person']
export const MANAGEMENT_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'office_admin']

export function canAccess(role: string, allowedRoles: string[]): boolean {
  if (UNLIMITED_ROLES.includes(role)) return true
  return allowedRoles.includes(role)
}
