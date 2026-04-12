'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import KioskFlow from '@/components/KioskFlow'
import Logo from '@/components/Logo'
import { useTheme } from '@/hooks/useTheme'

export default function KioskPage() {
  const { tokens: t } = useTheme()
  const [shopId, setShopId] = useState('')
  const [shopName, setShopName] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'enter_code' | 'error'>('loading')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const sid = p.get('shop') || ''

    if (sid) {
      // Direct access with ?shop=UUID (hidden fallback)
      setShopId(sid)
      const supabase = createClient()
      supabase.from('shops').select('name, dba').eq('id', sid).single()
        .then(({ data }: { data: { name: string; dba: string | null } | null }) => {
          if (data) {
            setShopName(data.dba || data.name || 'Service Center')
            setStatus('ready')
          } else {
            setStatus('error')
          }
        })
      return
    }

    // No shop param — try auto-redirect for logged-in users
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('users').select('shop_id').eq('id', user.id).single()
          if (profile?.shop_id) {
            const { data: shop } = await supabase.from('shops').select('kiosk_code').eq('id', profile.shop_id).single()
            if (shop?.kiosk_code) {
              window.location.replace(`/kiosk/${shop.kiosk_code}`)
              return
            }
          }
        }
      } catch {}
      setStatus('enter_code')
    })()
  }, [])

  if (status === 'loading') {
    return <div style={{ background: '#151520', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text, fontFamily: "'Instrument Sans', sans-serif" }}>
      <p>Loading...</p>
    </div>
  }

  if (status === 'enter_code') {
    return <div style={{ minHeight: '100vh', background: '#151520', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Instrument Sans', sans-serif" }}>
      <div style={{ textAlign: 'center', color: t.text, maxWidth: 400, padding: '0 24px' }}>
        <Logo size="lg" style={{ justifyContent: 'center', marginBottom: 24 }} />
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Check-In Kiosk</div>
        <div style={{ fontSize: 14, color: t.textSecondary, marginBottom: 24 }}>Enter your shop's kiosk code or scan the QR code at the front desk.</div>
        <form onSubmit={e => { e.preventDefault(); const code = (e.currentTarget.elements.namedItem('code') as HTMLInputElement)?.value?.trim(); if (code) window.location.href = `/kiosk/${code}` }}
          style={{ display: 'flex', gap: 8 }}>
          <input name="code" placeholder="e.g. ugl" autoFocus
            style={{ flex: 1, padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: t.border, color: t.text, fontSize: 18, fontFamily: "'Instrument Sans', sans-serif", outline: 'none', textAlign: 'center', letterSpacing: 2 }} />
          <button type="submit" style={{ padding: '14px 24px', borderRadius: 12, background: '#1D6FE8', color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif" }}>Go</button>
        </form>
      </div>
    </div>
  }

  if (status === 'error') {
    return <div style={{ background: '#151520', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text, fontFamily: "'Instrument Sans', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Shop Not Found</div>
        <p style={{ color: t.textSecondary }}>The shop ID is invalid.</p>
      </div>
    </div>
  }

  return <KioskFlow shopId={shopId} shopName={shopName} />
}
