'use client'
import { useTheme } from '@/hooks/useTheme'

const LABELS: Record<string, string> = {
  fleet_asset: 'Company Truck',
  owner_operator: 'Owner Operator',
  outside_customer: 'Outside Customer',
}

interface Props {
  type: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  dark?: boolean
}

export default function OwnershipTypeBadge({ type, size = 'md' }: Props) {
  const { tokens: t } = useTheme()
  const key = type || 'fleet_asset'

  const config: Record<string, { bg: string; color: string; border: string }> = {
    fleet_asset:      { bg: 'var(--tz-accentBg)', color: 'var(--tz-accentLight)', border: 'var(--tz-borderAccent)' },
    owner_operator:   { bg: 'var(--tz-warningBg)', color: 'var(--tz-warning)', border: 'var(--tz-warning)' },
    outside_customer: { bg: 'var(--tz-surfaceMuted)', color: 'var(--tz-textSecondary)', border: 'var(--tz-border)' },
  }
  const c = config[key] || config.fleet_asset
  const label = LABELS[key] || 'Company Truck'

  const fontSize = size === 'sm' ? 9 : size === 'lg' ? 13 : 11
  const padding = size === 'sm' ? '2px 6px' : size === 'lg' ? '5px 14px' : '3px 10px'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding, borderRadius: 100,
      fontSize, fontWeight: 700,
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

export function ownershipTypeLabel(type: string | null | undefined): string {
  return LABELS[type || 'fleet_asset'] || 'Company Truck'
}
