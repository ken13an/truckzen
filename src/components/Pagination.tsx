/**
 * TruckZen — Universal pagination component
 */
'use client'
import { useTheme } from '@/hooks/useTheme'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  label?: string
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, total, label = 'results', onPageChange }: PaginationProps) {
  const { tokens: t } = useTheme()
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--tz-textSecondary)' }}>{total.toLocaleString()} {label}</span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: page <= 1 ? 'var(--tz-bg)' : 'var(--tz-bgCard)', color: page <= 1 ? 'var(--tz-textTertiary)' : 'var(--tz-textSecondary)', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
          Previous
        </button>
        {pages.map((p, i) => p === '...' ? (
          <span key={`dots-${i}`} style={{ padding: '0 4px', color: 'var(--tz-textTertiary)' }}>...</span>
        ) : (
          <button key={p} onClick={() => onPageChange(p as number)}
            style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${p === page ? 'var(--tz-borderAccent)' : 'var(--tz-border)'}`, background: p === page ? 'var(--tz-accentBg)' : 'var(--tz-bgCard)', color: p === page ? 'var(--tz-accentLight)' : 'var(--tz-textSecondary)', cursor: 'pointer', fontSize: 12, fontWeight: p === page ? 700 : 400, minWidth: 32, fontFamily: 'inherit' }}>
            {p}
          </button>
        ))}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: page >= totalPages ? 'var(--tz-bg)' : 'var(--tz-bgCard)', color: page >= totalPages ? 'var(--tz-textTertiary)' : 'var(--tz-textSecondary)', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
          Next
        </button>
      </div>
    </div>
  )
}
