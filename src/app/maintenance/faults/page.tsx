'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import DataTable from '@/components/DataTable'
import { Zap } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'
const sevColor: Record<string, string> = { info: BLUE, warning: AMBER, critical: RED }

export default function FaultsPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [openCount, setOpenCount] = useState(0)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      const { count } = await supabase.from('maint_faults').select('*', { count: 'exact', head: true }).eq('shop_id', p.shop_id).eq('resolved', false)
      setOpenCount(count || 0)
    })
  }, [])

  if (!shopId) return <div style={{ background: t.bg, minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const filters = [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }]

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text }}>Faults</div>
        <a href="/maintenance/faults/new" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#1B6EE6,#1248B0)', border: 'none', borderRadius: 8, color: t.bgLight, fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>+ New</a>
      </div>

      {openCount > 0 && (
        <div style={{ background: `${RED}12`, border: `1px solid ${RED}33`, borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={18} color={RED} />
          <span style={{ fontSize: 24, fontWeight: 700, color: RED, fontFamily: MONO }}>{openCount.toLocaleString()}</span>
          <span style={{ fontSize: 13, color: RED }}>open faults</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {filters.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{ padding: '5px 12px', borderRadius: 100, border: filter === f.value ? '1px solid rgba(29,111,232,.3)' : `1px solid ${t.border}`, background: filter === f.value ? 'rgba(29,111,232,.1)' : 'transparent', color: filter === f.value ? t.accentLight : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>{f.label}</button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'fault_code', label: 'Code', render: (r: any) => <span style={{ fontFamily: MONO, fontWeight: 700, color: BLUE }}>{r.fault_code}</span> },
          { key: 'fault_description', label: 'Description', render: (r: any) => <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.fault_description?.slice(0, 50) || '—'}</span> },
          { key: 'severity', label: 'Severity', render: (r: any) => <span style={{ fontSize: 9, fontWeight: 600, color: sevColor[r.severity] || MUTED, background: `${sevColor[r.severity] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.severity}</span> },
          { key: 'resolved', label: 'Status', render: (r: any) => <span style={{ fontSize: 9, fontWeight: 600, color: r.resolved ? GREEN : RED, background: `${r.resolved ? GREEN : RED}18`, padding: '2px 6px', borderRadius: 4 }}>{r.resolved ? 'RESOLVED' : 'OPEN'}</span> },
          { key: 'first_seen', label: 'First Seen', render: (r: any) => r.first_seen ? new Date(r.first_seen).toLocaleDateString() : '—' },
          { key: 'occurrence_count', label: 'Count', render: (r: any) => <span style={{ fontFamily: MONO, fontWeight: 700 }}>{r.occurrence_count || 1}</span> },
        ]}
        fetchData={async (page, limit, search) => {
          let url = `/api/maintenance/crud?table=maint_faults&shop_id=${shopId}&page=${page}&limit=${limit}&order_by=created_at&search_cols=fault_code,fault_description`
          if (search) url += `&q=${encodeURIComponent(search)}`
          if (filter === 'open') url += `&filter_key=resolved&filter_val=false`
          if (filter === 'resolved') url += `&filter_key=resolved&filter_val=true`
          const res = await fetch(url)
          return res.ok ? res.json() : { data: [], total: 0 }
        }}
        label="faults"
        searchPlaceholder="Search by fault code..."
        onRowClick={(r: any) => { window.location.href = `/maintenance/faults/${r.id}` }}
        emptyMessage="No faults yet."
      />
    </div>
  )
}
