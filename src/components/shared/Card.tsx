'use client'
import { useTheme } from '@/hooks/useTheme'
import { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  style?: CSSProperties
  theme?: 'dark' | 'light'
  onClick?: () => void
}

export function Card({ children, style, theme = 'dark', onClick }: Props) {
  const { tokens: t } = useTheme()
  const isDark = theme === 'dark'
  return (
    <div
      onClick={onClick}
      style={{
        background: isDark ? 'var(--tz-bgCard)' : 'var(--tz-bgLight)',
        border: `1px solid ${isDark ? 'var(--tz-border)' : 'var(--tz-borderLight)'}`,
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
