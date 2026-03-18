// src/lib/supabase/client.ts
// Browser client — use in 'use client' components
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return new Proxy({} as any, {
      get: () => () => new Proxy({} as any, { get: () => () => ({ data: null, error: null }) }),
    }) as ReturnType<typeof createBrowserClient>
  }
  return createBrowserClient(url, key)
}
