'use client'
import { useTheme } from '@/hooks/useTheme'

const LABELS: Record<string, string> = {
  fullbay: 'Legacy',
  fleetio: 'Legacy',
  csv_import: 'Imported',
  import: 'Imported',
}

export default function SourceBadge({ source }: { source?: string | null }) {
  const { tokens: t } = useTheme()
  if (!source || source === 'truckzen' || source === 'walk_in' || source === 'phone' || source === 'kiosk' || source === 'portal' || source === 'telegram') return null
  const label = LABELS[source] || source
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 600,
      color: 'var(--tz-textSecondary)', background: 'rgba(124,139,160,.1)',
      border: '1px solid rgba(124,139,160,.15)',
      textTransform: 'uppercase', letterSpacing: '.04em',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      {label}
    </span>
  )
}
