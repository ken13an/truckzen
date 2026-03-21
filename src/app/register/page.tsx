'use client'
import { useState } from 'react'
import Logo from '@/components/Logo'

const FLEET_OPTIONS = ['1-10', '11-50', '51-200', '200+']
const SOFTWARE_OPTIONS = ['Fullbay', 'TMT', 'BigShop', 'Excel', 'Paper', 'Other']

export default function RegisterPage() {
  const [form, setForm] = useState({
    shop_name: '', owner_name: '', owner_email: '', owner_phone: '',
    city: '', state: '', fleet_size: '', current_software: '', message: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); setError('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.shop_name || !form.owner_name || !form.owner_email) {
      setError('Shop name, your name, and email are required.')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/platform-admin/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setLoading(false)
    if (res.ok) {
      setSubmitted(true)
    } else {
      const data = await res.json()
      setError(data.error || 'Something went wrong. Please try again.')
    }
  }

  if (submitted) {
    return (
      <div style={styles.page}>
        <div style={styles.grain} />
        <div style={styles.glow} />
        <div style={styles.card}>
          <Logo size="md" style={{ marginBottom: 28 }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Application Received!</div>
          <p style={{ fontSize: 13, color: '#7C8BA0', lineHeight: 1.6, margin: '0 0 20px' }}>
            Thank you for your interest in TruckZen. We&apos;ll review your application and get back to you within 24-48 hours.
          </p>
          <a href="/login" style={{ fontSize: 12, color: '#1D6FE8', textDecoration: 'none' }}>Back to login</a>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.grain} />
      <div style={styles.glow} />
      <div style={{ ...styles.card, maxWidth: 480 }}>
        <Logo size="md" style={{ marginBottom: 28 }} />
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Apply for Early Access</div>
        <div style={{ fontSize: 13, color: '#7C8BA0', marginBottom: 28 }}>Tell us about your shop and we&apos;ll get you set up.</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Shop Name */}
          <div>
            <label style={styles.label}>Shop Name *</label>
            <input value={form.shop_name} onChange={e => set('shop_name', e.target.value)} placeholder="Your truck shop name" style={styles.input} required />
          </div>

          {/* Owner Name + Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={styles.label}>Your Name *</label>
              <input value={form.owner_name} onChange={e => set('owner_name', e.target.value)} placeholder="Full name" style={styles.input} required />
            </div>
            <div>
              <label style={styles.label}>Email *</label>
              <input type="email" value={form.owner_email} onChange={e => set('owner_email', e.target.value)} placeholder="you@shop.com" style={styles.input} required />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label style={styles.label}>Phone</label>
            <input type="tel" value={form.owner_phone} onChange={e => set('owner_phone', e.target.value)} placeholder="(555) 123-4567" style={styles.input} />
          </div>

          {/* City + State */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={styles.label}>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" style={styles.input} />
            </div>
            <div>
              <label style={styles.label}>State</label>
              <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="TX" maxLength={2} style={styles.input} />
            </div>
          </div>

          {/* Fleet Size + Current Software */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={styles.label}>Fleet Size</label>
              <select value={form.fleet_size} onChange={e => set('fleet_size', e.target.value)} style={styles.input}>
                <option value="">Select...</option>
                {FLEET_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Current Software</label>
              <select value={form.current_software} onChange={e => set('current_software', e.target.value)} style={styles.input}>
                <option value="">Select...</option>
                {SOFTWARE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Message */}
          <div>
            <label style={styles.label}>Tell us about your shop</label>
            <textarea value={form.message} onChange={e => set('message', e.target.value)} placeholder="Optional — anything you'd like us to know" rows={3} style={{ ...styles.input, resize: 'vertical' }} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: loading ? 'rgba(255,255,255,.06)' : '#1D6FE8', color: loading ? '#7C8BA0' : '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Instrument Sans', sans-serif", marginTop: 4 }}>
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/login" style={{ fontSize: 12, color: '#1D6FE8', textDecoration: 'none' }}>Already have an account? Sign in</a>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 16, fontSize: 10, color: '#48536A', letterSpacing: '0.06em', zIndex: 1, fontFamily: "'IBM Plex Mono', monospace" }}>
        Powered by TruckZen &bull; Your Shop. Powered.
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#0a0a10', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 20,
    fontFamily: "'Instrument Sans', -apple-system, sans-serif", position: 'relative', overflow: 'hidden',
  },
  grain: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.4,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='0.03'/%3E%3C/svg%3E")`,
  },
  glow: {
    position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
    width: 600, height: 400,
    background: 'radial-gradient(ellipse, rgba(29,111,232,0.08) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  card: {
    width: '100%', maxWidth: 400, background: '#12131a',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
    padding: '40px 36px', position: 'relative', zIndex: 1,
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  label: {
    fontSize: 11, fontWeight: 600, color: '#7C8BA0', textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", display: 'block', marginBottom: 4,
  },
  input: {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13,
    color: '#DDE3EE', outline: 'none', fontFamily: "'Instrument Sans', sans-serif",
    boxSizing: 'border-box' as const, minHeight: 42,
  },
}
