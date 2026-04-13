'use client'
import { FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  title: string
  description?: string
}

export function EmptyState({ icon: Icon, title, description }: Props) {
  const { tokens: t } = useTheme()
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tz-textSecondary)', fontFamily: FONT }}>
      {Icon && <Icon size={40} style={{ marginBottom: 12, opacity: 0.4 }} />}
      <p style={{ fontSize: 15, fontWeight: 600 }}>{title}</p>
      {description && <p style={{ fontSize: 13, marginTop: 4, color: 'var(--tz-textTertiary)' }}>{description}</p>}
    </div>
  )
}
