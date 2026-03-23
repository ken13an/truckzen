'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import DataTable from '@/components/DataTable'
import { List, Calendar } from 'lucide-react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', BLUE = '#1B6EE6', MUTED = '#7C8BA0'
const stColor: Record<string, string> = { active: GREEN, on_time: GREEN, due_soon: AMBER, overdue: RED, paused: MUTED, completed: MUTED }

export default function PMSchedulesPage() {
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [filter, setFilter] = useState('all')
  const [calData, setCalData] = useState<any[]>([])
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      // Load calendar data
      supabase.from('maint_pm_schedules').select('id, service_type, custom_name, next_due_date, status, assets(unit_number)')
        .eq('shop_id', p.shop_id).eq('status', 'active')
        .then(({ data }) => setCalData(data || []))
    })
  }, [])

  if (!shopId) return <div style={{ background: '#060708', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const filters = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'completed', label: 'Completed' },
    { value: 'paused', label: 'Paused' },
  ]

  // Calendar helpers
  const year = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const today = new Date().toISOString().split('T')[0]
  const days: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  function pmsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return calData.filter(p => p.next_due_date === dateStr)
  }

  function pmColor(pm: any) {
    if (!pm.next_due_date) return MUTED
    if (pm.next_due_date < today) return RED
    const days = Math.floor((new Date(pm.next_due_date).getTime() - Date.now()) / 86400000)
    return days <= 7 ? AMBER : GREEN
  }

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>PM Schedules</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#161B24', borderRadius: 8, border: '1px solid rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <button onClick={() => setView('list')} style={{ padding: '6px 12px', background: view === 'list' ? 'rgba(29,111,232,.15)' : 'transparent', border: 'none', color: view === 'list' ? '#4D9EFF' : MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: FONT }}><List size={14} /> List</button>
            <button onClick={() => setView('calendar')} style={{ padding: '6px 12px', background: view === 'calendar' ? 'rgba(29,111,232,.15)' : 'transparent', border: 'none', color: view === 'calendar' ? '#4D9EFF' : MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: FONT }}><Calendar size={14} /> Calendar</button>
          </div>
          <a href="/maintenance/pm/new" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#1B6EE6,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>+ New</a>
        </div>
      </div>

      {view === 'list' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {filters.map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)} style={{ padding: '5px 12px', borderRadius: 100, border: filter === f.value ? '1px solid rgba(29,111,232,.3)' : '1px solid rgba(255,255,255,.08)', background: filter === f.value ? 'rgba(29,111,232,.1)' : 'transparent', color: filter === f.value ? '#4D9EFF' : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>{f.label}</button>
            ))}
          </div>
          <DataTable
            columns={[
              { key: 'service_type', label: 'Service', render: (r: any) => <span style={{ fontWeight: 600, color: '#F0F4FF' }}>{r.custom_name || r.service_type?.replace(/_/g, ' ')}</span> },
              { key: 'interval_miles', label: 'Interval', render: (r: any) => [r.interval_miles ? `${r.interval_miles.toLocaleString()} mi` : null, r.interval_days ? `${r.interval_days}d` : null].filter(Boolean).join(' / ') || '—' },
              { key: 'last_completed_date', label: 'Last Done', render: (r: any) => r.last_completed_date ? new Date(r.last_completed_date).toLocaleDateString() : '—' },
              { key: 'next_due_date', label: 'Next Due', render: (r: any) => r.next_due_date ? <span style={{ color: pmColor(r) }}>{new Date(r.next_due_date).toLocaleDateString()}</span> : '—' },
              { key: 'status', label: 'Status', render: (r: any) => <span style={{ fontSize: 9, fontWeight: 600, color: stColor[r.status] || MUTED, background: `${stColor[r.status] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.status?.replace(/_/g, ' ')}</span> },
            ]}
            fetchData={async (page, limit, search) => {
              let url = `/api/maintenance/crud?table=maint_pm_schedules&shop_id=${shopId}&page=${page}&limit=${limit}&order_by=next_due_date&order_asc=true&search_cols=service_type,custom_name`
              if (search) url += `&q=${encodeURIComponent(search)}`
              if (filter !== 'all') url += `&filter_key=status&filter_val=${filter}`
              const res = await fetch(url)
              return res.ok ? res.json() : { data: [], total: 0 }
            }}
            label="PM schedules"
            searchPlaceholder="Search by service type..."
            onRowClick={(r: any) => { window.location.href = `/maintenance/pm/${r.id}` }}
            emptyMessage="No PM schedules yet. Data will appear here once imported or created."
          />
        </>
      )}

      {view === 'calendar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} style={{ background: 'none', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '4px 12px', color: '#7C8BA0', cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>Prev</button>
            <div style={{ fontWeight: 700, color: '#F0F4FF', fontSize: 16 }}>{calMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
            <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} style={{ background: 'none', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '4px 12px', color: '#7C8BA0', cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>Next</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ padding: 6, textAlign: 'center', fontSize: 10, color: '#48536A', fontFamily: MONO }}>{d}</div>
            ))}
            {days.map((day, i) => {
              if (!day) return <div key={i} />
              const pms = pmsForDay(day)
              return (
                <div key={i} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.04)', borderRadius: 6, padding: 4, minHeight: 60 }}>
                  <div style={{ fontSize: 10, color: '#48536A', marginBottom: 2 }}>{day}</div>
                  {pms.slice(0, 3).map(pm => (
                    <div key={pm.id} onClick={() => window.location.href = `/maintenance/pm/${pm.id}`} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: `${pmColor(pm)}18`, color: pmColor(pm), marginBottom: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(pm.assets as any)?.unit_number ? `#${(pm.assets as any).unit_number}` : ''} {pm.custom_name || pm.service_type}
                    </div>
                  ))}
                  {pms.length > 3 && <div style={{ fontSize: 8, color: MUTED }}>+{pms.length - 3} more</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
