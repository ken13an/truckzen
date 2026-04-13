'use client'
import { useTheme } from '@/hooks/useTheme'

export default function FleetServiceRequestsPage() {
  const { tokens: t } = useTheme()
  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: "'Instrument Sans',sans-serif", padding: '32px clamp(20px, 4vw, 40px)' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: '.02em', color: 'var(--tz-text)', lineHeight: 1 }}>Fleet Service Requests</div>
          <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginTop: 6 }}>Coming soon &mdash; request intake for the fleet cluster</div>
        </div>
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--tz-textTertiary)', fontSize: 13 }}>
          This workspace is not wired up yet. Requests created here will appear once the intake flow is enabled.
        </div>
      </div>
    </div>
  )
}
