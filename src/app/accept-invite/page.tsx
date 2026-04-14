'use client'
import { useEffect, useState } from 'react'
import Logo from '@/components/Logo'
import { THEME } from '@/lib/config/colors'

const _t = THEME.dark

type InviteStatus =
  | { state: 'loading' }
  | { state: 'ready'; email: string; full_name: string; language: string }
  | { state: 'error'; message: string; code: string }

export default function AcceptInvitePage() {
  const [status, setStatus] = useState<InviteStatus>({ state: 'loading' })
  const [fullName, setFullName] = useState('')
  const [language, setLanguage] = useState('en')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [token, setToken] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token') || ''
    setToken(t)
    ;(async () => {
      try {
        const res = await fetch(`/api/accept-invite?token=${encodeURIComponent(t)}`)
        const data = await res.json()
        if (!res.ok) {
          setStatus({ state: 'error', message: data.error || 'Invitation could not be loaded.', code: data.code || 'invalid' })
          return
        }
        setFullName(data.full_name || '')
        setLanguage(data.language || 'en')
        setStatus({ state: 'ready', email: data.email, full_name: data.full_name, language: data.language })
      } catch {
        setStatus({ state: 'error', message: 'Network error. Please try again.', code: 'invalid' })
      }
    })()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Please enter your full name.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, full_name: fullName.trim(), language, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not accept invitation.'); setSubmitting(false); return }
      setDone(true)
      setTimeout(() => { window.location.href = '/login' }, 2000)
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  const S: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: _t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Instrument Sans',sans-serif" },
    card: { width: '100%', maxWidth: 420, background: _t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,.5)' },
    title: { fontSize: 22, fontWeight: 700, color: _t.text, marginBottom: 6 },
    sub: { fontSize: 13, color: _t.textSecondary, marginBottom: 24, lineHeight: 1.5 },
    label: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: _t.textSecondary, marginBottom: 6, display: 'block' },
    input: { width: '100%', padding: '11px 14px', background: _t.inputBg, border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 14, color: _t.text, outline: 'none', fontFamily: 'inherit', minHeight: 44, boxSizing: 'border-box' as const, marginBottom: 12 },
    btn: { width: '100%', padding: 13, background: `linear-gradient(135deg, ${_t.accent}, ${_t.accentHover})`, border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, color: _t.bgLight, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4, minHeight: 48 },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: _t.danger, marginBottom: 14 },
    emailRow: { padding: '10px 12px', background: _t.inputBg, border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, fontSize: 13, color: _t.textSecondary, marginBottom: 16 },
  }

  if (status.state === 'loading') return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: 'center' as const }}>
        <div style={{ fontSize: 14, color: _t.textSecondary }}>Loading your invitation...</div>
      </div>
    </div>
  )

  if (status.state === 'error') return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: 'center' as const }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
        <div style={S.title}>Invitation Unavailable</div>
        <div style={S.sub}>{status.message}</div>
        <a href="/login" style={{ ...S.btn, textDecoration: 'none', display: 'block', textAlign: 'center' as const }}>Go to Sign In</a>
      </div>
    </div>
  )

  if (done) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: 'center' as const }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: _t.success, marginBottom: 16 }}>Welcome aboard</div>
        <div style={S.title}>Account Ready</div>
        <div style={S.sub}>Redirecting you to sign in...</div>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.card}>
        <Logo size="sm" style={{ marginBottom: 24 }} />
        <div style={S.title}>Accept Your Invitation</div>
        <div style={S.sub}>Confirm your name, choose your language, and set a password.</div>
        <div style={S.emailRow}>{status.email}</div>
        {error && <div style={S.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={S.label}>Full Name</label>
          <input style={S.input} type="text" value={fullName} onChange={e => setFullName(e.target.value)} autoFocus required />

          <label style={S.label}>Language</label>
          <select style={{ ...S.input, appearance: 'none', cursor: 'pointer' }} value={language} onChange={e => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="ru">Russian</option>
            <option value="uz">Uzbek</option>
            <option value="es">Spanish</option>
          </select>

          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required />

          <label style={S.label}>Confirm Password</label>
          <input style={S.input} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Same password again" required />

          <button style={S.btn} type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Accept & Set Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
