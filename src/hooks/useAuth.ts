'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { setUser(null); return }
      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(data as User | null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { refresh() }, [refresh])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    window.location.href = '/login'
  }, [supabase])

  return { user, loading, signOut, refresh }
}
