'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const ALLOWED_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'service_writer']

export default function ShopFloorLayout({ children }: { children: React.ReactNode }) {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    getCurrentUser(supabase).then(p => {
      if (!p) { window.location.href = '/login'; return }
      const role = p.impersonate_role || p.role
      if (ALLOWED_ROLES.includes(role) || (!p.impersonate_role && p.is_platform_owner)) { setAllowed(true) }
      else { setAllowed(false); window.location.href = '/dashboard' }
    })
  }, [])

  if (allowed === null) return <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary }}>Loading...</div>
  if (!allowed) return null
  return <>{children}</>
}
