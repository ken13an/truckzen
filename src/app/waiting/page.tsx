'use client'
import { useTheme } from '@/hooks/useTheme'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function WaitingPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [userName, setUserName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }: any) => {
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()
      if (data) setUserName(data.full_name.split(' ')[0])
    })

    // Poll every 10s — redirect once setup is complete
    const timer = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('users')
        .select('role, shop_id')
        .eq('id', user.id)
        .single()
      if (!profile) return
      const { data: shop } = await supabase
        .from('shops')
        .select('setup_complete')
        .eq('id', profile.shop_id)
        .single()
      if (shop?.setup_complete) {
        window.location.href = '/dashboard'
      }
    }, 10000)

    return () => clearInterval(timer)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div style={{
      minHeight: '100vh', background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Instrument Sans', sans-serif", padding: '20px',
    }}>
      <div style={{
        maxWidth: '440px', textAlign: 'center',
        background: '#161B24', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px', padding: '48px 36px',
      }}>
        {/* Logo */}
        <div style={{
          width: '56px', height: '56px', borderRadius: '14px',
          background: 'linear-gradient(135deg,#1D6FE8,#1248B0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', boxShadow: '0 0 24px rgba(29,111,232,0.3)',
        }}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>

        <div style={{ fontSize: '22px', fontWeight: 700, color: t.text, marginBottom: '8px' }}>
          {userName ? `Hi ${userName}` : 'Almost ready'}
        </div>

        <div style={{ fontSize: '14px', color: t.textSecondary, lineHeight: 1.7, marginBottom: '28px' }}>
          Your shop admin is finishing setup. This page will update automatically once TruckZen is ready for you.
        </div>

        {/* Animated dots */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '28px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#1D6FE8', opacity: 0.4,
              animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}/>
          ))}
        </div>

        <div style={{
          padding: '12px 16px', background: 'rgba(29,111,232,0.06)',
          border: '1px solid rgba(29,111,232,0.15)', borderRadius: '9px',
          fontSize: '12px', color: '#4D9EFF', lineHeight: 1.6, marginBottom: '24px',
        }}>
          Checking every 10 seconds for updates
        </div>

        <button
          onClick={handleSignOut}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '9px 20px', color: t.textTertiary,
            fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.14s',
          }}
        >
          Sign Out
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.3; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
