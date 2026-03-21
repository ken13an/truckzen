'use client'
import { COLORS, FONT } from '@/lib/config/colors'
import { CSSProperties, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface Props {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  disabled?: boolean
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
  style?: CSSProperties
  type?: 'button' | 'submit'
}

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  primary: { background: COLORS.blue, color: '#fff', border: 'none' },
  secondary: { background: 'transparent', color: COLORS.textSecondary, border: `1px solid ${COLORS.border}` },
  danger: { background: COLORS.red, color: '#fff', border: 'none' },
  ghost: { background: 'transparent', color: COLORS.blue, border: 'none' },
}

const SIZE_STYLES: Record<string, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 12 },
  md: { padding: '9px 16px', fontSize: 13 },
  lg: { padding: '12px 24px', fontSize: 14 },
}

export function Button({ children, onClick, variant = 'primary', disabled, fullWidth, size = 'md', style, type = 'button' }: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 10,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: FONT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s',
        ...(fullWidth ? { width: '100%' } : {}),
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
    >
      {children}
    </button>
  )
}
