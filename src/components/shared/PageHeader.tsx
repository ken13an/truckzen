'use client'
import { FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
import { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumb?: { label: string; href: string }[]
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: Props) {
  const { tokens: t } = useTheme()
  return (
    <div style={{ marginBottom: 20, fontFamily: FONT }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, fontSize: 12, color: t.textSecondary }}>
          {breadcrumb.map((item, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: t.textTertiary }}>/</span>}
              <a href={item.href} style={{ color: t.accent, textDecoration: 'none' }}>{item.label}</a>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: t.text }}>{title}</h1>
          {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: t.textSecondary }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
      </div>
    </div>
  )
}
