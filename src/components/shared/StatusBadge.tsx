'use client'
import { useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'

interface Props { status: string; size?: 'sm' | 'md' }

export function StatusBadge({ status, size = 'sm' }: Props) {
  const { tokens: t } = useTheme()

  const statusStyles = useMemo(() => ({
    // WO statuses
    draft: { bg: 'rgba(124,139,160,0.15)', text: t.textSecondary },
    in_progress: { bg: t.accentBg, text: t.accent },
    waiting_parts: { bg: t.warningBg, text: t.warning },
    done: { bg: t.successBg, text: t.success },
    good_to_go: { bg: t.successBg, text: t.success },
    void: { bg: t.dangerBg, text: t.danger },
    // Job statuses
    pending: { bg: t.warningBg, text: t.warning },
    accepted: { bg: t.accentBg, text: t.accent },
    completed: { bg: t.successBg, text: t.success },
    declined: { bg: t.dangerBg, text: t.danger },
    // Invoice
    paid: { bg: t.successBg, text: t.success },
    sent: { bg: t.accentBg, text: t.accent },
    overdue: { bg: t.dangerBg, text: t.danger },
    // Parts
    requested: { bg: t.warningBg, text: t.warning },
    approved: { bg: t.successBg, text: t.success },
    rejected: { bg: t.dangerBg, text: t.danger },
    in_stock: { bg: t.successBg, text: t.success },
    ordered: { bg: t.accentBg, text: t.accent },
    ready: { bg: t.accentBg, text: t.accent },
  }), [t]) as Record<string, { bg: string; text: string }>

  const s = statusStyles[status] || { bg: 'rgba(255,255,255,0.08)', text: t.textSecondary }
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
