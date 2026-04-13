'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import DataTable from '@/components/DataTable'
import { AlertTriangle, Clock } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function ContactRenewalsPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [overdueCount, setOverdueCount] = useState(0)
  const [dueSoonCount, setDueSoonCount] = useState(0)
  const [filter, setFilter] = useState('all')
  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      const [{ count: ov }, { count: ds }] = await Promise.all([
        supabase.from('maint_contact_renewals').select('*', { count: 'exact', head: true }).eq('shop_id', p.shop_id).eq('status', 'active').lt('expiry_date', today),
        supabase.from('maint_contact_renewals').select('*', { count: 'exact', head: true }).eq('shop_id', p.shop_id).eq('status', 'active').gte('expiry_date', today).lte('expiry_date', in30),
      ])
      setOverdueCount(ov || 0)
      setDueSoonCount(ds || 0)
    })
  }, [])

  if (!shopId) return <div style={{ background: t.bg, minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  function expiryColor(d: string) { if (!d) return MUTED; return d < today ? RED : d <= in30 ? AMBER : GREEN }

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text }}>Contact Renewals</div>
        <a href="/maintenance/contact-renewals/new" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#1B6EE6,#1248B0)', border: 'none', borderRadius: 8, color: t.bgLight, fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>+ New</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: `${RED}12`, border: `1px solid ${RED}33`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}><AlertTriangle size={18} color={RED} /><span style={{ fontSize: 28, fontWeight: 700, color: RED, fontFamily: MONO }}>{overdueCount}</span><span style={{ fontSize: 13, color: RED }}>Overdue</span></div>
        <div style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}33`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}><Clock size={18} color={AMBER} /><span style={{ fontSize: 28, fontWeight: 700, color: AMBER, fontFamily: MONO }}>{dueSoonCount}</span><span style={{ fontSize: 13, color: AMBER }}>Due Soon</span></div>
      </div>
      <DataTable
        columns={[
          { key: 'renewal_type', label: 'Type', render: (r: any) => <span style={{ fontWeight: 600, color: t.text, textTransform: 'capitalize' }}>{r.custom_name || r.renewal_type?.replace(/_/g, ' ')}</span> },
          { key: 'expiry_date', label: 'Expiry', render: (r: any) => <span style={{ color: expiryColor(r.expiry_date), fontFamily: MONO }}>{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '—'}</span> },
          { key: 'cost', label: 'Cost', render: (r: any) => r.cost ? `$${r.cost.toFixed(2)}` : '—' },
          { key: 'status', label: 'Status', render: (r: any) => { const expired = r.expiry_date && r.expiry_date < today; return <span style={{ fontSize: 9, fontWeight: 600, color: expired ? RED : GREEN, background: `${expired ? RED : GREEN}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{expired ? 'EXPIRED' : r.status}</span> } },
        ]}
        fetchData={async (page, limit, search) => {
          let url = `/api/maintenance/crud?table=maint_contact_renewals&shop_id=${shopId}&page=${page}&limit=${limit}&order_by=expiry_date&order_asc=true&search_cols=renewal_type,custom_name`
          if (search) url += `&q=${encodeURIComponent(search)}`
          if (filter !== 'all') url += `&filter_key=status&filter_val=${filter}`
          const res = await fetch(url)
          return res.ok ? res.json() : { data: [], total: 0 }
        }}
        label="contact renewals"
        searchPlaceholder="Search renewals..."
        emptyMessage="No contact renewals yet."
      />
    </div>
  )
}
