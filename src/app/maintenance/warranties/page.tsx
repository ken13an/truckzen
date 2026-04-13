'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import DataTable from '@/components/DataTable'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function WarrantiesPage() {
  const { tokens: th } = useTheme()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [tab, setTab] = useState<'warranties' | 'claims'>('warranties')
  const today = new Date().toISOString().split('T')[0]
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => { if (!p) { window.location.href = '/login'; return }; setShopId(p.shop_id) })
  }, [])

  if (!shopId) return <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const stColor: Record<string, string> = { active: GREEN, expired: RED, submitted: BLUE, approved: GREEN, denied: RED, paid: GREEN }

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)' }}>Warranties</div>
        <a href="/maintenance/warranties/new" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#1B6EE6,#1248B0)', border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>+ New</a>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${'var(--tz-border)'}` }}>
        {(['warranties', 'claims'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent', color: tab === t ? 'var(--tz-text)' : MUTED, fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize' }}>{t === 'warranties' ? 'Active Warranties' : 'Claims'}</button>
        ))}
      </div>

      {tab === 'warranties' && (
        <DataTable
          columns={[
            { key: 'warranty_type', label: 'Type', render: (r: any) => <span style={{ fontWeight: 600, color: 'var(--tz-text)', textTransform: 'capitalize' }}>{r.warranty_type?.replace(/_/g, ' ')}</span> },
            { key: 'provider', label: 'Provider' },
            { key: 'end_date', label: 'End Date', render: (r: any) => { const c = !r.end_date ? MUTED : r.end_date < today ? RED : r.end_date <= in90 ? AMBER : GREEN; return <span style={{ color: c, fontFamily: MONO }}>{r.end_date ? new Date(r.end_date).toLocaleDateString() : '—'}</span> } },
            { key: 'end_miles', label: 'End Miles', render: (r: any) => r.end_miles ? r.end_miles.toLocaleString() : '—' },
            { key: 'claim_count', label: 'Claims', render: (r: any) => <span style={{ fontFamily: MONO, fontWeight: 700 }}>{r.claim_count || 0}</span> },
            { key: 'total_claimed', label: 'Claimed', render: (r: any) => <span style={{ fontFamily: MONO }}>${(r.total_claimed || 0).toFixed(0)}</span> },
            { key: 'current_status', label: 'Status', render: (r: any) => <span style={{ fontSize: 9, fontWeight: 600, color: stColor[r.current_status] || MUTED, background: `${stColor[r.current_status] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.current_status}</span> },
          ]}
          fetchData={async (page, limit, search) => {
            const res = await fetch(`/api/maintenance/crud?table=maint_warranties&shop_id=${shopId}&page=${page}&limit=${limit}&order_by=end_date&order_asc=true&search_cols=warranty_type,provider${search ? `&q=${encodeURIComponent(search)}` : ''}`)
            return res.ok ? res.json() : { data: [], total: 0 }
          }}
          label="warranties"
          searchPlaceholder="Search warranties..."
          emptyMessage="No warranties yet."
        />
      )}

      {tab === 'claims' && (
        <DataTable
          columns={[
            { key: 'claim_date', label: 'Date', render: (r: any) => r.claim_date ? new Date(r.claim_date).toLocaleDateString() : '—' },
            { key: 'description', label: 'Description', render: (r: any) => <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.description?.slice(0, 50) || '—'}</span> },
            { key: 'amount_claimed', label: 'Claimed', render: (r: any) => <span style={{ fontFamily: MONO }}>${(r.amount_claimed || 0).toFixed(2)}</span> },
            { key: 'amount_approved', label: 'Approved', render: (r: any) => <span style={{ fontFamily: MONO, color: GREEN }}>${(r.amount_approved || 0).toFixed(2)}</span> },
            { key: 'status', label: 'Status', render: (r: any) => <span style={{ fontSize: 9, fontWeight: 600, color: stColor[r.status] || MUTED, background: `${stColor[r.status] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.status}</span> },
          ]}
          fetchData={async (page, limit, search) => {
            const res = await fetch(`/api/maintenance/crud?table=maint_warranty_claims&shop_id=${shopId}&page=${page}&limit=${limit}&order_by=claim_date&search_cols=description${search ? `&q=${encodeURIComponent(search)}` : ''}`)
            return res.ok ? res.json() : { data: [], total: 0 }
          }}
          label="warranty claims"
          searchPlaceholder="Search claims..."
          emptyMessage="No warranty claims yet."
        />
      )}
    </div>
  )
}
