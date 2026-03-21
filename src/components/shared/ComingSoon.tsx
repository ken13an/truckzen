'use client'
import { COLORS, FONT } from '@/lib/config/colors'
import { Construction } from 'lucide-react'

interface Props { feature: string }

export function ComingSoon({ feature }: Props) {
  return (
    <div style={{
      background: COLORS.bgDark, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      <div style={{
        background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16,
        padding: '48px 40px', textAlign: 'center', maxWidth: 400,
      }}>
        <Construction size={40} color={COLORS.textSecondary} style={{ marginBottom: 16, opacity: 0.5 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: COLORS.text }}>{feature}</h2>
        <p style={{ margin: 0, fontSize: 14, color: COLORS.textSecondary }}>This feature is coming soon.</p>
      </div>
    </div>
  )
}
