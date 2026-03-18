// app/error.tsx — catches runtime errors in the app
'use client'
import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log to Sentry in production
    console.error(error)
  }, [error])

  return (
    <div style={{ minHeight:'100vh', background:'#060708', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Instrument Sans',sans-serif", padding:20 }}>
      <div style={{ maxWidth:440, textAlign:'center' }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:80, letterSpacing:'.04em', color:'rgba(217,79,79,.15)', lineHeight:1 }}>ERR</div>
        <div style={{ fontSize:20, fontWeight:700, color:'#F0F4FF', margin:'16px 0 8px' }}>Something went wrong</div>
        <div style={{ fontSize:13, color:'#7C8BA0', lineHeight:1.6, marginBottom:24 }}>
          An unexpected error occurred. The team has been notified.
          {error?.digest && <div style={{ fontFamily:'monospace', fontSize:10, color:'#48536A', marginTop:8 }}>Error ID: {error.digest}</div>}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={reset} style={{ padding:'10px 20px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            Try Again
          </button>
          <a href="/dashboard" style={{ padding:'10px 20px', background:'#161B24', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#DDE3EE', fontSize:13, fontWeight:600, textDecoration:'none' }}>
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
