import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div style={{ minHeight:'100vh', background:'#060708', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Instrument Sans',sans-serif", padding:20 }}>
      <div style={{ maxWidth:440, textAlign:'center' }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:100, letterSpacing:'.04em', color:'rgba(29,111,232,.1)', lineHeight:1 }}>404</div>
        <div style={{ fontSize:20, fontWeight:700, color:'#F0F4FF', margin:'12px 0 8px' }}>Page not found</div>
        <div style={{ fontSize:13, color:'#7C8BA0', lineHeight:1.6, marginBottom:24 }}>
          The page you're looking for doesn't exist or you don't have access.
        </div>
        <a href="/dashboard" style={{ display:'inline-block', padding:'11px 24px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', borderRadius:9, color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none' }}>
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}
