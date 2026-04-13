'use client'
import { useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'

interface Props { status: string; size?: 'sm' | 'md' }

export function StatusBadge({ status, size = 'sm' }: Props) {
  const { tokens: t } = useTheme()

  const statusStyles = useMemo(() => ({
    // WO statuses
    draft: { bg: 'rgba(124,139,160,0.15)', text: 'var(--tz-textSecondary)' },
    in_progress: { bg: 'var(--tz-accentBg)', text: 'var(--tz-accent)' },
    waiting_parts: { bg: 'var(--tz-warningBg)', text: 'var(--tz-warning)' },
    done: { bg: 'var(--tz-successBg)', text: 'var(--tz-success)' },
    good_to_go: { bg: 'var(--tz-successBg)', text: 'var(--tz-success)' },
    void: { bg: 'var(--tz-dangerBg)', text: 'var(--tz-danger)' },
    // Job statuses
    pending: { bg: 'var(--tz-warningBg)', text: 'var(--tz-warning)' },
    accepted: { bg: 'var(--tz-accentBg)', text: 'var(--tz-accent)' },
    completed: { bg: 'var(--tz-successBg)', text: 'var(--tz-success)' },
    declined: { bg: 'var(--tz-dangerBg)', text: 'var(--tz-danger)' },
    // Invoice
    paid: { bg: 'var(--tz-successBg)', text: 'var(--tz-success)' },
    sent: { bg: 'var(--tz-accentBg)', text: 'var(--tz-accent)' },
    overdue: { bg: 'var(--tz-dangerBg)', text: 'var(--tz-danger)' },
    // Parts
    requested: { bg: 'var(--tz-warningBg)', text: 'var(--tz-warning)' },
    approved: { bg: 'var(--tz-successBg)', text: 'var(--tz-success)' },
    rejected: { bg: 'var(--tz-dangerBg)', text: 'var(--tz-danger)' },
    in_stock: { bg: 'var(--tz-successBg)', text: 'var(--tz-success)' },
    ordered: { bg: 'var(--tz-accentBg)', text: 'var(--tz-accent)' },
    ready: { bg: 'var(--tz-accentBg)', text: 'var(--tz-accent)' },
  }), [t]) as Record<string, { bg: string; text: string }>

  const s = statusStyles[status] || { bg: 'var(--tz-border)', text: 'var(--tz-textSecondary)' }
  return (
    <span style={{
      display: 'inline-block',
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 999,
      background: s.bg,
      color: s.text,
      fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
