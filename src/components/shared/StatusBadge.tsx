'use client'
import { COLORS } from '@/lib/config/colors'

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  // WO statuses
  draft: { bg: 'rgba(124,139,160,0.15)', text: COLORS.textSecondary },
  in_progress: { bg: COLORS.blueBg, text: COLORS.blue },
  waiting_parts: { bg: COLORS.amberBg, text: COLORS.amber },
  done: { bg: COLORS.greenBg, text: COLORS.green },
  good_to_go: { bg: COLORS.greenBg, text: COLORS.green },
  void: { bg: COLORS.redBg, text: COLORS.red },
  // Job statuses
  pending: { bg: COLORS.amberBg, text: COLORS.amber },
  accepted: { bg: COLORS.blueBg, text: COLORS.blue },
  completed: { bg: COLORS.greenBg, text: COLORS.green },
  declined: { bg: COLORS.redBg, text: COLORS.red },
  // Invoice
  paid: { bg: COLORS.greenBg, text: COLORS.green },
  sent: { bg: COLORS.blueBg, text: COLORS.blue },
  overdue: { bg: COLORS.redBg, text: COLORS.red },
  // Parts
  requested: { bg: COLORS.amberBg, text: COLORS.amber },
  approved: { bg: COLORS.greenBg, text: COLORS.green },
  rejected: { bg: COLORS.redBg, text: COLORS.red },
  in_stock: { bg: COLORS.greenBg, text: COLORS.green },
  ordered: { bg: COLORS.blueBg, text: COLORS.blue },
  ready: { bg: COLORS.blueBg, text: COLORS.blue },
}

interface Props { status: string; size?: 'sm' | 'md' }

export function StatusBadge({ status, size = 'sm' }: Props) {
  const s = STATUS_STYLES[status] || { bg: 'rgba(255,255,255,0.08)', text: COLORS.textSecondary }
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
