'use client'

const CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  fleet_asset:       { label: 'Company Truck',     bg: '#EFF6FF', color: '#1D6FE8', border: '#BFDBFE' },
  owner_operator:    { label: 'Owner Operator',    bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  outside_customer:  { label: 'Outside Customer',  bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
}

// Dark theme variant
const CONFIG_DARK: Record<string, { label: string; bg: string; color: string; border: string }> = {
  fleet_asset:       { label: 'Company Truck',     bg: 'rgba(29,111,232,.12)', color: '#4D9EFF', border: 'rgba(29,111,232,.25)' },
  owner_operator:    { label: 'Owner Operator',    bg: 'rgba(217,119,6,.12)',  color: '#F59E0B', border: 'rgba(217,119,6,.25)' },
  outside_customer:  { label: 'Outside Customer',  bg: 'rgba(107,114,128,.12)', color: '#9CA3AF', border: 'rgba(107,114,128,.25)' },
}

interface Props {
  type: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  dark?: boolean
}

export default function OwnershipTypeBadge({ type, size = 'md', dark = false }: Props) {
  const cfg = dark ? CONFIG_DARK : CONFIG
  const c = cfg[type || 'fleet_asset'] || cfg.fleet_asset

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
      {c.label}
    </span>
  )
}

export function ownershipTypeLabel(type: string | null | undefined): string {
  return CONFIG[type || 'fleet_asset']?.label || 'Company Truck'
}
