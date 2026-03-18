'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── ROLE → REDIRECT MAP ──────────────────────────────────────
// Each role lands on their most relevant page after login
// This is the ONLY place roles map to routes
const ROLE_REDIRECT: Record<string, string> = {
  owner:                   '/dashboard',
  gm:                      '/dashboard',
  it_person:               '/dashboard',
  shop_manager:            '/dashboard',
  service_advisor:         '/orders',
  service_writer:          '/orders',
  technician:              '/floor',
  parts_manager:           '/parts',
  fleet_manager:           '/fleet',
  maintenance_manager:     '/maintenance',
  maintenance_technician:  '/maintenance',
  accountant:              '/accounting',
  office_admin:            '/settings',
  dispatcher:              '/fleet',
  driver:                  '/dvir',
  customer:                '/portal',
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [checkingSession, setCheckingSession] = useState(true)

  // ── ALREADY LOGGED IN? ───────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      if (session) {
        await redirectByRole(session.user.id)
      } else {
        setCheckingSession(false)
      }
    })
  }, [])

  // ── REDIRECT BASED ON ROLE ───────────────────────────────
  async function redirectByRole(userId: string) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, shop_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      setError('Account not set up yet. Ask your admin.')
      setLoading(false)
      setCheckingSession(false)
      return
    }

    // Check if first-time setup is needed
    const { data: shop } = await supabase
      .from('shops')
      .select('setup_complete')
      .eq('id', profile.shop_id)
      .single()

    if (shop && !shop.setup_complete) {
      if (profile.role === 'office_admin' || profile.role === 'owner') {
        router.replace('/setup')
      } else {
        router.replace('/waiting')
      }
      return
    }

    // Role-based redirect — no role picker, ever
    const destination = ROLE_REDIRECT[profile.role] ?? '/dashboard'
    router.replace(destination)
  }

  // ── SUBMIT ───────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      setLoading(false)
      // Don't reveal whether the email exists — same message for both cases
      if (authError.message.includes('Invalid login') ||
          authError.message.includes('Email not confirmed') ||
          authError.message.includes('Invalid email')) {
        setError('Incorrect email or password.')
      } else if (authError.message.includes('Too many')) {
        setError('Too many attempts. Wait a few minutes and try again.')
      } else {
        setError('Login failed. Contact your admin if this continues.')
      }
      return
    }

    if (!data.user) {
      setLoading(false)
      setError('Login failed. Try again.')
      return
    }

    await redirectByRole(data.user.id)
  }

  // ── LOADING STATE ────────────────────────────────────────
  if (checkingSession) {
    return (
      <div style={styles.checkingWrap}>
        <div style={styles.spinner}/>
      </div>
    )
  }

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Background grain */}
      <div style={styles.grain}/>

      {/* Ambient glow */}
      <div style={styles.glow}/>

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <div style={styles.logoMark}>
            <svg viewBox="0 0 24 24" width="18" height="18"
              fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={styles.logoText}>
            TRUCK<span style={styles.logoAccent}>ZEN</span>
          </div>
        </div>

        {/* Heading */}
        <div style={styles.heading}>Welcome back</div>
        <div style={styles.subheading}>
          Sign in to your shop account
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={styles.form}>
          {/* Email */}
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="you@yourshop.com"
              style={styles.input}
              disabled={loading}
              required
            />
          </div>

          {/* Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="password">Password</label>
            <div style={styles.passWrap}>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                style={{ ...styles.input, paddingRight: '44px' }}
                disabled={loading}
                required
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPass(p => !p)}
                tabIndex={-1}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45
                      18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11
                      8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={styles.errorBox}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            style={loading ? styles.btnLoading : styles.btn}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.btnInner}>
                <span style={styles.btnSpinner}/>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Forgot password */}
        <div style={styles.forgot}>
          <a href="/forgot-password" style={styles.forgotLink}>
            Forgot password?
          </a>
        </div>

        {/* Footer note */}
        <div style={styles.footerNote}>
          No account? Contact your shop admin.
        </div>
      </div>

      {/* Bottom branding */}
      <div style={styles.bottomBrand}>
        Powered by TruckZen &bull; Your Shop. Powered.
      </div>
    </div>
  )
}

// ── STYLES ───────────────────────────────────────────────────
// Inline styles so this works before Tailwind is set up
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#060708',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: "'Instrument Sans', -apple-system, sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  grain: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='0.03'/%3E%3C/svg%3E")`,
    pointerEvents: 'none',
    zIndex: 0,
    opacity: 0.4,
  },
  glow: {
    position: 'fixed',
    top: '20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '400px',
    background: 'radial-gradient(ellipse, rgba(29,111,232,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#161B24',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '36px 32px',
    position: 'relative',
    zIndex: 1,
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '28px',
  },
  logoMark: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #1D6FE8, #1248B0)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 14px rgba(29,111,232,0.35)',
  },
  logoText: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '18px',
    letterSpacing: '0.1em',
    color: '#F0F4FF',
  },
  logoAccent: {
    color: '#4D9EFF',
  },
  heading: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#F0F4FF',
    marginBottom: '6px',
  },
  subheading: {
    fontSize: '13px',
    color: '#7C8BA0',
    marginBottom: '28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#7C8BA0',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    background: '#1C2130',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#DDE3EE',
    outline: 'none',
    fontFamily: "'Instrument Sans', sans-serif",
    transition: 'border-color 0.15s',
    minHeight: '44px',
    boxSizing: 'border-box',
  },
  passWrap: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#48536A',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: 'rgba(217,79,79,0.08)',
    border: '1px solid rgba(217,79,79,0.2)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#D94F4F',
    lineHeight: 1.4,
  },
  btn: {
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #1D6FE8, #1248B0)',
    border: 'none',
    borderRadius: '9px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    marginTop: '4px',
    minHeight: '48px',
    boxShadow: '0 0 16px rgba(29,111,232,0.3)',
    fontFamily: "'Instrument Sans', sans-serif",
    transition: 'all 0.15s',
  },
  btnLoading: {
    width: '100%',
    padding: '13px',
    background: '#1C2130',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '9px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#7C8BA0',
    cursor: 'not-allowed',
    marginTop: '4px',
    minHeight: '48px',
    fontFamily: "'Instrument Sans', sans-serif",
  },
  btnInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  btnSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(124,139,160,0.3)',
    borderTopColor: '#7C8BA0',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  forgot: {
    textAlign: 'center',
    marginTop: '16px',
  },
  forgotLink: {
    fontSize: '12px',
    color: '#48536A',
    textDecoration: 'none',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#48536A',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  bottomBrand: {
    position: 'fixed',
    bottom: '16px',
    fontSize: '10px',
    color: '#48536A',
    letterSpacing: '0.06em',
    zIndex: 1,
    fontFamily: "'IBM Plex Mono', monospace",
  },
  checkingWrap: {
    minHeight: '100vh',
    background: '#060708',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '2px solid rgba(29,111,232,0.2)',
    borderTopColor: '#1D6FE8',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
}
