'use client'
import { COLORS, FONT } from '@/lib/config/colors'
import { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: number
}

export function Modal({ open, onClose, title, children, maxWidth = 440 }: Props) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: COLORS.bgCard, borderRadius: 16, width: '100%', maxWidth,
        border: `1px solid ${COLORS.borderCard}`, overflow: 'hidden', fontFamily: FONT,
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${COLORS.borderCard}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.text }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: COLORS.textSecondary, cursor: 'pointer', fontSize: 18, padding: 4,
          }}>&times;</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}
