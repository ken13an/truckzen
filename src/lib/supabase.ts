import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // Return a dummy client during build/prerender when env vars are not available
    return new Proxy({} as any, {
      get: () => () => new Proxy({} as any, { get: () => () => ({ data: null, error: null }) }),
    }) as ReturnType<typeof createBrowserClient>
  }
  return createBrowserClient(url, key)
}
export async function getCurrentUser(supabase: any) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
    return data
  } catch { return null }
}
export function createServerSupabaseClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
