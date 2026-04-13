'use client'
import { FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
import { Construction } from 'lucide-react'

interface Props { feature: string }

export function ComingSoon({ feature }: Props) {
  const { tokens: t } = useTheme()
  return (
    <div style={{
      background: 'var(--tz-bgAlt)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      <div style={{
        background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 16,
        padding: '48px 40px', textAlign: 'center', maxWidth: 400,
      }}>
        <Construction size={40} color={'var(--tz-textSecondary)'} style={{ marginBottom: 16, opacity: 0.5 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--tz-text)' }}>{feature}</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--tz-textSecondary)' }}>This feature is coming soon.</p>
      </div>
    </div>
  )
}
