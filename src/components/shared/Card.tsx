'use client'
import { COLORS } from '@/lib/config/colors'
import { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  style?: CSSProperties
  theme?: 'dark' | 'light'
  onClick?: () => void
}

export function Card({ children, style, theme = 'dark', onClick }: Props) {
  const isDark = theme === 'dark'
  return (
    <div
      onClick={onClick}
      style={{
        background: isDark ? COLORS.bgCard : COLORS.bgLight,
        border: `1px solid ${isDark ? COLORS.border : COLORS.borderLight}`,
        borderRadius: 12,
        padding: 16,
        ...(onClick ? { cursor: 'pointer' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
