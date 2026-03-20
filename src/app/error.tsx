// app/error.tsx — catches runtime errors in the app
'use client'
import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log to Sentry in production
    console.error(error)
  }, [error])

  return (
    <div style={{ minHeight:'100vh', background:'#0A0A0A', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Instrument Sans',sans-serif", padding:20 }}>
      <div style={{ maxWidth:440, textAlign:'center' }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:80, letterSpacing:'.04em', color:'rgba(217,79,79,.15)', lineHeight:1 }}>ERR</div>
        <div style={{ fontSize:20, fontWeight:700, color:'#F5F5F7', margin:'16px 0 8px' }}>Something went wrong</div>
        <div style={{ fontSize:13, color:'#8E8E93', lineHeight:1.6, marginBottom:24 }}>
          An unexpected error occurred. The team has been notified.
          {error?.digest && <div style={{ fontFamily:'monospace', fontSize:10, color:'#8E8E93', marginTop:8 }}>Error ID: {error.digest}</div>}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={reset} style={{ padding:'10px 20px', background:'linear-gradient(135deg,#0A84FF,#0A84FF)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            Try Again
          </button>
          <a href="/dashboard" style={{ padding:'10px 20px', background:'#2A2A2A', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#F5F5F7', fontSize:13, fontWeight:600, textDecoration:'none' }}>
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
