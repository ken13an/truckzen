// src/lib/supabase/server.ts
// Server client — use in API routes and Server Components
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for API routes
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

// Auth helper — get current user profile from DB
export async function getCurrentUser(supabase: ReturnType<typeof createServerSupabaseClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, shop_id, full_name, email, role, team, language, telegram_id, active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.active) return null
  return profile
}
