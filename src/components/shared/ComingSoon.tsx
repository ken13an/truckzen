'use client'
import { FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
import { Construction } from 'lucide-react'

interface Props { feature: string }

export function ComingSoon({ feature }: Props) {
  const { tokens: t } = useTheme()
  return (
    <div style={{
      background: t.bgAlt, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      <div style={{
        background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16,
        padding: '48px 40px', textAlign: 'center', maxWidth: 400,
      }}>
        <Construction size={40} color={t.textSecondary} style={{ marginBottom: 16, opacity: 0.5 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: t.text }}>{feature}</h2>
        <p style={{ margin: 0, fontSize: 14, color: t.textSecondary }}>This feature is coming soon.</p>
      </div>
    </div>
  )
}
