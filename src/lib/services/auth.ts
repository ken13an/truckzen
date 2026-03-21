import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types'

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null
  const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  return data as User | null
}

export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}
