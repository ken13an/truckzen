// src/lib/supabase/server.ts
// Server helpers for API routes and Server Components
import { createRequestSupabaseClient, createAdminSupabaseClient, getAuthenticatedUserProfile } from '@/lib/server-auth'

export async function createServerSupabaseClient() {
  return createRequestSupabaseClient()
}

export function createServiceRoleSupabaseClient() {
  return createAdminSupabaseClient()
}

// Backward-compatible helper. Existing callers may pass a client argument; it is ignored.
export async function getCurrentUser(_supabase?: unknown) {
  return getAuthenticatedUserProfile()
}
