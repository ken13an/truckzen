'use client'
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const font = "'Instrument Sans', sans-serif"

export default function KioskAdminPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [shop, setShop] = useState<any>(null)

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      const { data } = await supabase.from('shops').select('id, name, dba').eq('id', p.shop_id).single()
      setShop(data)
    })
  }, [])

  if (!user || !shop) return <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary, fontFamily: font }}>Loading...</div>

  const kioskUrl = `${window.location.origin}/kiosk/${shop.kiosk_code || 'ugl'}`

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: font, padding: 24 }}>
      <a href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: t.border, borderRadius: 8, fontSize: 14, fontWeight: 700, color: t.text, textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Dashboard
</a>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Kiosk</div>
      <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 24 }}>Self-service check-in for your waiting area. Open on a tablet in full-screen mode.</div>

      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, maxWidth: 560, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Kiosk Configuration</div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Shop Name</label>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{shop.dba || shop.name}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Kiosk URL</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ fontSize: 11, color: t.accentLight, background: 'rgba(29,111,232,.08)', padding: '6px 10px', borderRadius: 6, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kioskUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(kioskUrl); alert('Copied!') }}
              style={{ padding: '6px 14px', background: t.border, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: font, whiteSpace: 'nowrap' }}>Copy</button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>Check-in form fields</div>
          {['Company Name', 'Driver Name', 'Phone Number', 'Unit Number', 'Concern Description'].map(field => (
            <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: t.accent, width: 16, height: 16 }} />
              {field}
            </label>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>Languages</div>
          {['English', 'Russian', 'Uzbek', 'Spanish'].map(lang => (
            <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: t.accent, width: 16, height: 16 }} />
              {lang}
            </label>
          ))}
        </div>
      </div>

      <a href={kioskUrl} target="_blank" rel="noopener"
        style={{ display: 'inline-block', padding: '14px 28px', background: t.accent, border: 'none', borderRadius: 10, color: t.bgLight, fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 20px rgba(29,111,232,.25)' }}>
        Launch Kiosk Mode
      </a>
    </div>
  )
}
