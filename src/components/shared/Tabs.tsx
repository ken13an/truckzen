'use client'
import { FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
import { ReactNode } from 'react'

interface Tab { label: string; icon?: ReactNode }

interface Props {
  tabs: Tab[]
  active: number
  onChange: (index: number) => void
}

export function Tabs({ tabs, active, onChange }: Props) {
  const { tokens: t } = useTheme()
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${'var(--tz-borderCard)'}`, fontFamily: FONT }}>
      {tabs.map((tab, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            flex: 1, padding: '12px 16px', background: 'none', border: 'none',
            color: active === i ? 'var(--tz-accent)' : 'var(--tz-textSecondary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            borderBottom: active === i ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'color 0.15s',
          }}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </div>
  )
}
