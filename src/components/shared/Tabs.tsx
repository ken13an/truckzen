'use client'
import { COLORS, FONT } from '@/lib/config/colors'
import { ReactNode } from 'react'

interface Tab { label: string; icon?: ReactNode }

interface Props {
  tabs: Tab[]
  active: number
  onChange: (index: number) => void
}

export function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.borderCard}`, fontFamily: FONT }}>
      {tabs.map((tab, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            flex: 1, padding: '12px 16px', background: 'none', border: 'none',
            color: active === i ? COLORS.blue : COLORS.textSecondary,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            borderBottom: active === i ? `2px solid ${COLORS.blue}` : '2px solid transparent',
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
