'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import { THEME } from '@/lib/config/colors'
const _t = THEME.dark

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState('')
  const [validSession, setValid]  = useState(false)
  const [checking, setChecking]   = useState(true)

  useEffect(() => {
    // Listen for auth state change — Supabase processes the URL hash token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setValid(true)
        setChecking(false)
      }
    })

    // Also check existing session after a delay (URL hash processing)
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession() as any
      if (session) setValid(true)
      setChecking(false)
    }, 2000)

    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm)  { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => window.location.href = '/login', 2000)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { minHeight:'100vh', background:_t.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Instrument Sans',sans-serif" },
    card:  { width:'100%', maxWidth:400, background:_t.bgCard, border:'1px solid rgba(255,255,255,.08)', borderRadius:16, padding:'36px 32px', boxShadow:'0 24px 64px rgba(0,0,0,.5)' },
    title: { fontSize:22, fontWeight:700, color:_t.text, marginBottom:6 },
    sub:   { fontSize:13, color:_t.textSecondary, marginBottom:24, lineHeight:1.5 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:_t.textSecondary, marginBottom:6, display:'block' },
    input: { width:'100%', padding:'11px 14px', background:_t.inputBg, border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:14, color:_t.text, outline:'none', fontFamily:'inherit', minHeight:44, boxSizing:'border-box' as const, marginBottom:12 },
    btn:   { width:'100%', padding:13, background:'linear-gradient(135deg,${_t.accent},${_t.accentHover})', border:'none', borderRadius:9, fontSize:14, fontWeight:700, color:_t.bgLight, cursor:'pointer', fontFamily:'inherit', marginTop:4, minHeight:48 },
    error: { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:_t.danger, marginBottom:14 },
  }

  if (checking) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign:'center' as const }}>
        <div style={{ fontSize: 14, color: _t.textSecondary }}>Verifying reset link...</div>
      </div>
    </div>
  )

  if (!validSession) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign:'center' as const }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⛔</div>
        <div style={S.title}>Link Expired</div>
        <div style={S.sub}>This reset link has expired or already been used.</div>
        <a href="/forgot-password" style={{ ...S.btn, textDecoration:'none', display:'block', textAlign:'center' as const }}>Request New Link</a>
      </div>
    </div>
  )

  if (done) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign:'center' as const }}>
        <div style={{ fontSize:16, fontWeight:700, color:_t.success, marginBottom:16 }}>Success</div>
        <div style={S.title}>Password Updated</div>
        <div style={S.sub}>Redirecting you to login...</div>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.card}>
        <Logo size="sm" style={{ marginBottom: 24 }} />
        <div style={S.title}>Set New Password</div>
        <div style={S.sub}>Choose a strong password for your account.</div>
        {error && <div style={S.error}>{error}</div>}
        <form onSubmit={handleReset}>
          <label style={S.label}>New Password</label>
          <input style={S.input} type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }} placeholder="At least 8 characters" autoFocus required/>
          <label style={S.label}>Confirm Password</label>
          <input style={S.input} type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }} placeholder="Same password again" required/>
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
