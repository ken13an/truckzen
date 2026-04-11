'use client'
import { useState } from 'react'
import { useVinDecode, VinResult } from '@/hooks/useVinDecode'
import { FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
import { Loader2, Search, CheckCircle2 } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  onDecode?: (result: VinResult) => void
  theme?: 'dark' | 'light'
}

export function VinInput({ value, onChange, onDecode, theme = 'dark' }: Props) {
  const { tokens: t } = useTheme()
  const { decode, result, loading, error } = useVinDecode()
  const isDark = theme === 'dark'

  async function handleDecode() {
    const data = await decode(value)
    if (data && onDecode) onDecode(data)
  }

  function handleChange(v: string) {
    const upper = v.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17)
    onChange(upper)
    // Auto-decode when 17 chars
    if (upper.length === 17) {
      decode(upper).then(data => { if (data && onDecode) onDecode(data) })
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder="Enter 17-character VIN"
          maxLength={17}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 13, fontFamily: FONT,
            border: `1px solid ${isDark ? t.border : t.borderLight}`,
            background: isDark ? t.bgCard : '#fff',
            color: isDark ? t.text : t.textLight,
            outline: 'none', boxSizing: 'border-box',
            letterSpacing: '1px', textTransform: 'uppercase',
          }}
        />
        <button
          onClick={handleDecode}
          disabled={loading || value.length !== 17}
          style={{
            padding: '10px 16px', borderRadius: 10, border: `1px solid ${t.accent}`,
            background: 'transparent', color: t.accent, fontSize: 12, fontWeight: 700,
            cursor: loading || value.length !== 17 ? 'not-allowed' : 'pointer',
            fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6,
            opacity: loading || value.length !== 17 ? 0.5 : 1,
          }}
        >
          {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
          Decode
        </button>
      </div>
      <div style={{ fontSize: 11, color: isDark ? t.textTertiary : t.textLightSecondary, marginTop: 4 }}>
        {value.length}/17 characters
      </div>

      {error && <div style={{ color: t.danger, fontSize: 12, marginTop: 6 }}>{error}</div>}

      {result && !error && (
        <div style={{
          marginTop: 8, padding: '10px 14px', borderRadius: 8,
          background: isDark ? 'rgba(34,197,94,0.08)' : '#f0fdf4',
          border: `1px solid ${isDark ? 'rgba(34,197,94,0.2)' : '#bbf7d0'}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <CheckCircle2 size={16} color={t.success} />
          <div style={{ fontSize: 13, color: isDark ? t.text : t.textLight }}>
            <strong>{result.year} {result.make} {result.model}</strong>
            {result.engine && <span style={{ color: isDark ? t.textSecondary : t.textLightSecondary }}> — {result.engine}</span>}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
