'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import DataTable from '@/components/DataTable'
import { AlertTriangle, Clock } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = 'var(--tz-textSecondary)'
const stColor: Record<string, string> = { active: GREEN, on_time: GREEN, due_soon: AMBER, overdue: RED }

export default function ServiceRemindersPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [overdueCount, setOverdueCount] = useState(0)
  const [dueSoonCount, setDueSoonCount] = useState(0)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      const [{ count: ov }, { count: ds }] = await Promise.all([
        supabase.from('maint_service_reminders').select('*', { count: 'exact', head: true }).eq('shop_id', p.shop_id).eq('overdue', true),
        supabase.from('maint_service_reminders').select('*', { count: 'exact', head: true }).eq('shop_id', p.shop_id).eq('status', 'active').lte('next_due_date', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]).gt('next_due_date', new Date().toISOString().split('T')[0]),
      ])
      setOverdueCount(ov || 0)
      setDueSoonCount(ds || 0)
    })
  }, [])

  if (!shopId) return <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)' }}>Service Reminders</div>
        <a href="/maintenance/service-reminders/new" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#1B6EE6,#1248B0)', border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>+ New</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: `${RED}12`, border: `1px solid ${RED}33`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} color={RED} /><span style={{ fontSize: 28, fontWeight: 700, color: RED, fontFamily: MONO }}>{overdueCount}</span><span style={{ fontSize: 13, color: RED }}>Overdue</span>
        </div>
        <div style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}33`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={18} color={AMBER} /><span style={{ fontSize: 28, fontWeight: 700, color: AMBER, fontFamily: MONO }}>{dueSoonCount}</span><span style={{ fontSize: 13, color: AMBER }}>Due Soon</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'overdue', label: 'Overdue' }].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{ padding: '5px 12px', borderRadius: 100, border: filter === f.value ? '1px solid rgba(29,111,232,.3)' : `1px solid ${'var(--tz-border)'}`, background: filter === f.value ? 'rgba(29,111,232,.1)' : 'transparent', color: filter === f.value ? 'var(--tz-accentLight)' : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>{f.label}</button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'reminder_type', label: 'Type', render: (r: any) => <span style={{ fontWeight: 600, color: 'var(--tz-text)', textTransform: 'capitalize' }}>{r.custom_name || r.reminder_type?.replace(/_/g, ' ')}</span> },
          { key: 'interval_miles', label: 'Interval', render: (r: any) => [r.interval_miles ? `${r.interval_miles.toLocaleString()} mi` : null, r.interval_days ? `${r.interval_days}d` : null].filter(Boolean).join(' / ') || '—' },
          { key: 'last_completed_date', label: 'Last Done', render: (r: any) => r.last_completed_date ? new Date(r.last_completed_date).toLocaleDateString() : '—' },
          { key: 'next_due_date', label: 'Next Due', render: (r: any) => { const c = r.overdue ? RED : r.next_due_date && new Date(r.next_due_date) < new Date(Date.now() + 30 * 86400000) ? AMBER : GREEN; return <span style={{ color: c }}>{r.next_due_date ? new Date(r.next_due_date).toLocaleDateString() : '—'}</span> } },
          { key: 'status', label: 'Status', render: (r: any) => { const st = r.overdue ? 'overdue' : r.status; return <span style={{ fontSize: 9, fontWeight: 600, color: stColor[st] || MUTED, background: `${stColor[st] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{st?.replace(/_/g, ' ')}</span> } },
        ]}
        fetchData={async (page, limit, search) => {
          let url = `/api/maintenance/crud?table=maint_service_reminders&shop_id=${shopId}&page=${page}&limit=${limit}&order_by=next_due_date&order_asc=true&search_cols=reminder_type,custom_name`
          if (search) url += `&q=${encodeURIComponent(search)}`
          if (filter === 'overdue') url += `&filter_key=overdue&filter_val=true`
          else if (filter === 'active') url += `&filter_key=status&filter_val=active`
          const res = await fetch(url)
          return res.ok ? res.json() : { data: [], total: 0 }
        }}
        label="service reminders"
        searchPlaceholder="Search reminders..."
        emptyMessage="No service reminders yet."
      />
    </div>
  )
}
