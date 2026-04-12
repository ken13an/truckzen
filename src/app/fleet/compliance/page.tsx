'use client'
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

export default function FleetCompliancePage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'expired' | 'expiring' | 'current'>('all')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      const res = await fetch(`/api/compliance?shop_id=${p.shop_id}&limit=100`)
      if (res.ok) { const j = await res.json(); setItems(j.data || j) }
      setLoading(false)
    })
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const filtered = items.filter(i => {
    if (filter === 'expired') return i.expiry_date < today
    if (filter === 'expiring') return i.expiry_date >= today && i.expiry_date <= in30
    if (filter === 'current') return i.expiry_date > in30
    return true
  })

  const expired = items.filter(i => i.expiry_date < today).length
  const expiring = items.filter(i => i.expiry_date >= today && i.expiry_date <= in30).length

  const S: Record<string, React.CSSProperties> = {
    page: { background: t.bg, minHeight: '100vh', color: t.text, fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
    title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 4 },
    tab: { padding: '8px 16px', fontSize: 12, fontWeight: 600, color: t.textSecondary, textDecoration: 'none', borderRadius: 8, background: t.bgCard },
    tabActive: { color: t.accentLight, background: 'rgba(29,111,232,.1)', border: '1px solid rgba(29,111,232,.2)' },
    th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.textTertiary, textTransform: 'uppercase' as const, letterSpacing: '.1em', padding: '7px 12px', textAlign: 'left' as const, background: t.bgInput },
    td: { padding: '10px 12px', borderBottom: `1px solid ${t.border}`, fontSize: 12, color: t.textSecondary },
  }

  return (
    <div style={S.page}>
      <a href="/fleet" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: t.bgHover, borderRadius: 8, fontSize: 14, fontWeight: 700, color: t.text, textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Fleet
</a>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a href="/fleet" style={S.tab}>Vehicles</a>
        <a href="/drivers" style={S.tab}>Drivers</a>
        <a href="/dvir" style={S.tab}>DVIR</a>
        <a href="/maintenance" style={S.tab}>Maintenance</a>
        <a href="/fleet/compliance" style={{ ...S.tab, ...S.tabActive }}>Compliance</a>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={S.title}>Compliance</div>
          <div style={{ fontSize: 12, color: t.textSecondary }}>
            {items.length} items · <span style={{ color: t.danger }}>{expired} expired</span> · <span style={{ color: t.warning }}>{expiring} expiring soon</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['all', 'expired', 'expiring', 'current'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 6, border: filter === f ? `1px solid ${t.accent}` : `1px solid ${t.border}`, background: filter === f ? 'rgba(29,111,232,.08)' : t.bgCard, color: filter === f ? t.accentLight : t.textTertiary, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Type', 'Document', 'Unit / Driver', 'Expiry', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', padding: 40, color: t.textSecondary }}>Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', padding: 40, color: t.textTertiary }}>No items</td></tr>
            : filtered.map(i => {
              const isExpired = i.expiry_date < today
              const isExpiring = !isExpired && i.expiry_date <= in30
              return (
                <tr key={i.id}>
                  <td style={{ ...S.td, fontWeight: 600, color: t.text, fontSize: 11, textTransform: 'uppercase' }}>{i.item_type?.replace(/_/g, ' ')}</td>
                  <td style={S.td}>{i.document_name}</td>
                  <td style={S.td}>{(i.assets as any)?.unit_number || (i.drivers as any)?.full_name || '—'}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{i.expiry_date}</td>
                  <td style={{ ...S.td, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', color: isExpired ? t.danger : isExpiring ? t.warning : t.success }}>
                    {isExpired ? 'EXPIRED' : isExpiring ? 'EXPIRING' : 'CURRENT'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
