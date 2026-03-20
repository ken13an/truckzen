import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Access Denied',
  robots: { index: false, follow: false },
}

export default function ForbiddenPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Instrument Sans',sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 100, letterSpacing: '.04em', color: 'rgba(239,68,68,.15)', lineHeight: 1 }}>403</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#F0F4FF', margin: '12px 0 8px' }}>Access Denied</div>
        <div style={{ fontSize: 13, color: '#7C8BA0', lineHeight: 1.6, marginBottom: 24 }}>
          You don't have permission to access this page. Contact your shop manager or IT admin if you need access.
        </div>
        <a href="/dashboard" style={{ display: 'inline-block', padding: '11px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}
