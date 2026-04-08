'use client'
import { useMemo } from 'react'
import { ROLE_CONFIGS } from '@/lib/config/roles'
import { ADMIN_ROLES } from '@/lib/roles'
import type { Role } from '@/types'

export function usePermission(role: Role | undefined) {
  const config = useMemo(() => role ? ROLE_CONFIGS[role] : null, [role])

  const hasPermission = (permission: string): boolean => {
    if (!config) return false
    if ('*' in config.permissions && config.permissions['*']) return true
    return config.permissions[permission] === true
  }

  const isAdmin = (): boolean => {
    if (!role) return false
    return ADMIN_ROLES.includes(role)
  }

  return { hasPermission, isAdmin, config }
}
