'use client'

import { useState, useRef } from 'react'
import { Sparkles, Loader2, Check, X } from 'lucide-react'

interface AITextInputProps {
  value: string
  onChange: (value: string) => void
  context: 'kiosk' | 'service_writer' | 'mechanic' | 'supervisor'
  language?: string
  truckInfo?: { year?: string; make?: string; model?: string; engine?: string }
  shopId?: string
  userId?: string
  placeholder?: string
  rows?: number
  label?: string
  /** 'dark' (default) or 'light' for white-bg pages like WO detail */
  theme?: 'dark' | 'light'
  /** Additional style overrides for the textarea */
  style?: React.CSSProperties
}

export default function AITextInput({
  value,
  onChange,
  context,
  language = 'en',
  truckInfo,
  shopId,
  userId,
  placeholder,
  rows = 3,
  label,
  theme = 'dark',
  style,
}: AITextInputProps) {
  const isDark = theme === 'dark'
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function enhance() {
    if (!value.trim() || value.trim().length < 5) return
    setLoading(true)
    setError('')
    setSuggestion(null)

    try {
      const res = await fetch('/api/ai/service-writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: value.trim(),
          context,
          language,
          truck_info: truckInfo,
          shop_id: shopId,
          user_id: userId,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || 'AI unavailable')
        return
      }

      const data = await res.json()
      setSuggestion(data)
    } catch {
      setError('AI request failed')
    } finally {
      setLoading(false)
    }
  }

  function acceptSuggestion() {
    if (!suggestion) return

    if (context === 'kiosk' || context === 'service_writer') {
      onChange(suggestion.concern || value)
    } else if (context === 'mechanic') {
      // Build a formatted string from mechanic fields
      const parts = []
      if (suggestion.cause) parts.push(`Cause: ${suggestion.cause}`)
      if (suggestion.correction) parts.push(`Correction: ${suggestion.correction}`)
      if (suggestion.parts?.length) parts.push(`Parts: ${suggestion.parts.join(', ')}`)
      if (suggestion.labor_hours) parts.push(`Est. Labor: ${suggestion.labor_hours} hrs`)
      onChange(parts.join('\n'))
    } else if (context === 'supervisor') {
      onChange(suggestion.note || value)
    }

    setSuggestion(null)
  }

  function dismissSuggestion() {
    setSuggestion(null)
  }

  // Primary field the AI returns for display
  function getSuggestionPreview(): string {
    if (!suggestion) return ''
    if (context === 'kiosk' || context === 'service_writer') return suggestion.concern || ''
    if (context === 'mechanic') {
      const parts = []
      if (suggestion.cause) parts.push(`Cause: ${suggestion.cause}`)
      if (suggestion.correction) parts.push(`Correction: ${suggestion.correction}`)
      if (suggestion.parts?.length) parts.push(`Parts: ${suggestion.parts.join(', ')}`)
      if (suggestion.labor_hours) parts.push(`Est. Labor: ${suggestion.labor_hours} hrs`)
      return parts.join('\n')
    }
    if (context === 'supervisor') return suggestion.note || ''
    return ''
  }

  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#cbd5e1' }}>
          {label}
        </label>
      )}

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          padding: '12px 14px',
          paddingRight: 48,
          borderRadius: 10,
          border: '1px solid #334155',
          background: '#1e293b',
          color: '#f1f5f9',
          fontSize: 15,
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
          ...style,
        }}
      />

      {/* AI Enhance Button */}
      <button
        onClick={enhance}
        disabled={loading || !value.trim() || value.trim().length < 5}
        title="AI Enhance"
        style={{
          position: 'absolute',
          right: 10,
          top: label ? 38 : 10,
          background: loading ? '#334155' : '#6366f1',
          border: 'none',
          borderRadius: 8,
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
          opacity: !value.trim() || value.trim().length < 5 ? 0.4 : 1,
          transition: 'all 0.2s',
        }}
      >
        {loading ? (
          <Loader2 size={18} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Sparkles size={18} color="#fff" />
        )}
      </button>

      {/* Error */}
      {error && (
        <div style={{ color: '#f87171', fontSize: 13, marginTop: 4 }}>{error}</div>
      )}

      {/* Suggestion Card */}
      {suggestion && (
        <div
          style={{
            marginTop: 8,
            background: isDark ? '#1e293b' : '#f8fafc',
            border: '1px solid #6366f1',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sparkles size={14} color="#6366f1" />
            <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              AI Suggestion
            </span>
          </div>

          <div style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {getSuggestionPreview()}
          </div>

          {/* Native language translation if present */}
          {(suggestion.concern_native || suggestion.cause_native || suggestion.note_native) && (
            <div style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: 13, marginTop: 8, fontStyle: 'italic' }}>
              {suggestion.concern_native || suggestion.cause_native || suggestion.note_native}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={acceptSuggestion}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                background: '#22c55e',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Check size={14} /> Accept
            </button>
            <button
              onClick={dismissSuggestion}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                background: isDark ? '#334155' : '#e2e8f0',
                color: isDark ? '#94a3b8' : '#6b7280',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <X size={14} /> Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
