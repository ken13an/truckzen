'use client'
import { Modal } from './Modal'
import { Button } from './Button'
import { useTheme } from '@/hooks/useTheme'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'primary', loading }: Props) {
  const { tokens: t } = useTheme()
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={380}>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--tz-textSecondary)', lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
