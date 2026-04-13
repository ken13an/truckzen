'use client'
import { useTheme } from '@/hooks/useTheme'

export default function FleetServiceRequestsPage() {
  const { tokens: t } = useTheme()
  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: "'Instrument Sans',sans-serif", padding: '32px clamp(20px, 4vw, 40px)' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: '.02em', color: t.text, lineHeight: 1 }}>Fleet Service Requests</div>
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 6 }}>Coming soon &mdash; request intake for the fleet cluster</div>
        </div>
        <div style={{ background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: 40, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>
          This workspace is not wired up yet. Requests created here will appear once the intake flow is enabled.
        </div>
      </div>
    </div>
  )
}
