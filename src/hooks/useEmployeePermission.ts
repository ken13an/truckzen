'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { ADMIN_ROLES } from '@/lib/roles'

let cachedPermissions: Record<string, boolean> | null = null
let cachedRole: string | null = null

export function useEmployeePermission(key: string): boolean {
  const [allowed, setAllowed] = useState<boolean>(true) // default allow until loaded
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      if (cachedPermissions !== null) {
        setAllowed(cachedPermissions[key] !== false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('shop_id, role')
        .eq('id', user.id)
        .single()

      // Owners/admins always have all permissions
      if (ADMIN_ROLES.includes(userData?.role)) {
        cachedPermissions = {}
        cachedRole = userData.role
        setAllowed(true)
        return
      }

      cachedRole = userData?.role ?? null

      const { data } = await supabase
        .from('employee_permissions')
        .select('permissions')
        .eq('shop_id', userData?.shop_id)
        .eq('employee_id', user.id)
        .single()

      cachedPermissions = data?.permissions ?? {}
      setAllowed(cachedPermissions![key] !== false)
    }
    load()
  }, [key])

  return allowed
}
