'use client'
import { useState, useRef, useEffect } from 'react'
import { FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
import { Search } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

export function SearchInput({ value, onChange, placeholder = 'Search...', debounceMs = 300 }: Props) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setLocal(value) }, [value])

  function handleChange(v: string) {
    setLocal(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v), debounceMs)
  }

  const { tokens: t } = useTheme()

  return (
    <div style={{ position: 'relative' }}>
      <Search size={16} color={t.textSecondary} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
      <input
        value={local}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
          border: `1px solid ${t.border}`, background: t.bgCard, color: t.text,
          fontFamily: FONT, fontSize: 13, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
