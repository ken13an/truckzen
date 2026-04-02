'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function TwoFactorPage() {
  const router = useRouter()
  const supabase = createClient()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Check if user has a pending 2FA session
    const pending = sessionStorage.getItem('tz_2fa_pending')
    if (!pending) {
      router.replace('/login')
      return
    }
    setUserId(pending)
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) { setError('Enter a 6-digit code.'); return }

    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate', user_id: userId, code }),
    })

    if (!res.ok) {
      setLoading(false)
      const data = await res.json()
      setError(data.error || 'Invalid code. Please try again.')
      setCode('')
      inputRef.current?.focus()
      return
    }

    // 2FA passed — complete the login
    sessionStorage.removeItem('tz_2fa_pending')

    // Register session token
    try { await fetch('/api/auth/session', { method: 'POST' }) } catch {}

    // Redirect to dashboard
    router.replace('/dashboard')
  }

  function handleCancel() {
    sessionStorage.removeItem('tz_2fa_pending')
    supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 380, padding: 'clamp(20px, 4vw, 32px)', background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Logo size="md" style={{ marginBottom: 20 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F0F4FF', marginBottom: 6 }}>Two-Factor Authentication</div>
          <div style={{ fontSize: 13, color: '#7C8BA0' }}>Enter the 6-digit code from your authenticator app</div>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
            placeholder="000000"
            autoComplete="one-time-code"
            style={{
              width: '100%', padding: '14px 16px', background: '#1C2130',
              border: error ? '1px solid #EF4444' : '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, fontSize: 24, fontWeight: 700, color: '#F0F4FF',
              textAlign: 'center', letterSpacing: '0.3em', outline: 'none',
              fontFamily: "'IBM Plex Mono', monospace", boxSizing: 'border-box',
            }}
          />

          {error && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', fontSize: 13, color: '#EF4444', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || code.length !== 6} style={{
            width: '100%', marginTop: 16, padding: '12px 0',
            background: code.length === 6 ? 'linear-gradient(135deg, #1D6FE8, #1248B0)' : '#1C2130',
            border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: code.length === 6 && !loading ? 'pointer' : 'default',
            opacity: loading ? 0.5 : 1, fontFamily: 'inherit',
          }}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <button onClick={handleCancel} style={{
          width: '100%', marginTop: 10, padding: '10px 0', background: 'none',
          border: '1px solid rgba(255,255,255,.08)', borderRadius: 10,
          color: '#7C8BA0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Cancel and sign out
        </button>
      </div>
    </div>
  )
}
