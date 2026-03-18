// src/lib/supabase/index.ts
// Single import point — use this everywhere
// Client components: import { createClient } from '@/lib/supabase'
// API routes:        import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export { createClient } from './client'
export { createServerSupabaseClient, getCurrentUser } from './server'
