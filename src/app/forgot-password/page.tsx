'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError('Enter your email address'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })
    if (err) { setError('Could not send reset email. Check the address and try again.'); setLoading(false); return }
    setSent(true)
  }

  const S: Record<string, React.CSSProperties> = {
    page:    { minHeight:'100vh', background:'#060708', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Instrument Sans',sans-serif" },
    card:    { width:'100%', maxWidth:400, background:'#161B24', border:'1px solid rgba(255,255,255,.08)', borderRadius:16, padding:'36px 32px', boxShadow:'0 24px 64px rgba(0,0,0,.5)' },
    logo:    { display:'flex', alignItems:'center', gap:10, marginBottom:28 },
    mark:    { width:32, height:32, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' },
    title:   { fontSize:22, fontWeight:700, color:'#F0F4FF', marginBottom:6 },
    sub:     { fontSize:13, color:'#7C8BA0', marginBottom:24, lineHeight:1.5 },
    label:   { fontFamily:"'IBM Plex Mono',monospace", fontSize:11, letterSpacing:'.08em', textTransform:'uppercase' as const, color:'#7C8BA0', marginBottom:6, display:'block' },
    input:   { width:'100%', padding:'11px 14px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:14, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:44, boxSizing:'border-box' as const },
    btn:     { width:'100%', padding:13, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:9, fontSize:14, fontWeight:700, color:'#fff', cursor:'pointer', marginTop:16, minHeight:48, fontFamily:'inherit' },
    error:   { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:'#D94F4F', marginTop:10 },
    back:    { display:'block', textAlign:'center' as const, marginTop:20, fontSize:12, color:'#48536A', textDecoration:'none' },
    success: { textAlign:'center' as const, padding:'20px 0' },
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.mark}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:'.1em', color:'#F0F4FF' }}>
            TRUCK<span style={{ color:'#4D9EFF' }}>ZEN</span>
          </span>
        </div>

        {sent ? (
          <div style={S.success}>
            <div style={{ fontSize:40, marginBottom:16 }}>📬</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#F0F4FF', marginBottom:8 }}>Check your email</div>
            <div style={{ fontSize:13, color:'#7C8BA0', lineHeight:1.6 }}>
              We sent a password reset link to <strong style={{ color:'#DDE3EE' }}>{email}</strong>.<br/>
              Check your inbox and click the link.
            </div>
            <a href="/login" style={{ ...S.back, marginTop:24, color:'#4D9EFF' }}>Back to login</a>
          </div>
        ) : (
          <>
            <div style={S.title}>Reset password</div>
            <div style={S.sub}>Enter your work email and we'll send a reset link.</div>
            <form onSubmit={handleSubmit}>
              <label style={S.label}>Email</label>
              <input style={S.input} type="email" autoFocus value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="you@yourshop.com" required/>
              {error && <div style={S.error}>{error}</div>}
              <button style={S.btn} type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <a href="/login" style={S.back}>Back to login</a>
          </>
        )}
      </div>
    </div>
  )
}
