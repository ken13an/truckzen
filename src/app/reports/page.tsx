'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = '#1D6FE8', GREEN = '#22C55E', RED = '#EF4444', AMBER = '#F59E0B', GRAY = '#6B7280'

const TABS = ['Overview', 'Revenue', 'Labor', 'Parts', 'Trucks']

import DateRangePicker from '@/components/DateRangePicker'

export default function ReportsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateLabel, setDateLabel] = useState('')
  const [loading, setLoading] = useState(true)

  // Data
  const [overview, setOverview] = useState<any>(null)
  const [prevOverview, setPrevOverview] = useState<any>(null)
  const [revenueByDay, setRevenueByDay] = useState<any[]>([])
  const [topCustomers, setTopCustomers] = useState<any[]>([])
  const [laborData, setLaborData] = useState<any[]>([])
  const [partsData, setPartsData] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [trucksData, setTrucksData] = useState<any[]>([])

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
    })
  }, [])

  useEffect(() => {
    if (user && dateFrom && dateTo) loadData()
  }, [user, dateFrom, dateTo, tab])

  function handleDateChange(from: string, to: string, label: string) {
    setDateFrom(from)
    setDateTo(to)
    setDateLabel(label)
  }

  async function loadData() {
    setLoading(true)
    const base = `/api/reports?shop_id=${user.shop_id}&from=${dateFrom}&to=${dateTo}`

    // Always load overview
    const ovRes = await fetch(`${base}&type=overview`)
    if (ovRes.ok) setOverview(await ovRes.json())

    // Load previous period for comparison
    const days = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000
    const prevTo = new Date(new Date(dateFrom).getTime() - 86400000).toISOString().split('T')[0]
    const prevFrom = new Date(new Date(dateFrom).getTime() - days * 86400000).toISOString().split('T')[0]
    const prevRes = await fetch(`/api/reports?shop_id=${user.shop_id}&from=${prevFrom}&to=${prevTo}&type=overview`)
    if (prevRes.ok) setPrevOverview(await prevRes.json())

    // Tab-specific data
    if (tab === 1) {
      const [rdRes, tcRes] = await Promise.all([
        fetch(`${base}&type=revenue_by_day`),
        fetch(`${base}&type=top_customers`),
      ])
      if (rdRes.ok) setRevenueByDay(await rdRes.json())
      if (tcRes.ok) setTopCustomers(await tcRes.json())
    }
    if (tab === 2) {
      const lRes = await fetch(`${base}&type=labor`)
      if (lRes.ok) setLaborData(await lRes.json())
    }
    if (tab === 3) {
      const [ppRes, lsRes] = await Promise.all([
        fetch(`${base}&type=parts_profitability`),
        fetch(`${base}&type=low_stock`),
      ])
      if (ppRes.ok) setPartsData(await ppRes.json())
      if (lsRes.ok) setLowStock(await lsRes.json())
    }
    if (tab === 4) {
      const tRes = await fetch(`${base}&type=trucks`)
      if (tRes.ok) setTrucksData(await tRes.json())
    }

    setLoading(false)
  }

  const fmt = (n: number) => '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return d } }
  const pctChange = (curr: number, prev: number) => {
    if (!prev) return null
    return Math.round(((curr - prev) / prev) * 100)
  }

  if (!user) return null

  return (
    <div style={{ fontFamily: FONT, color: '#1A1A1A', background: '#fff', minHeight: '100vh', maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px' }}>Reports</h1>
        <DateRangePicker onChange={handleDateChange} defaultPreset="this_month" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E7EB', marginBottom: 20 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: tab === i ? 700 : 500, cursor: 'pointer', fontFamily: FONT,
            background: 'none', border: 'none', borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
            color: tab === i ? BLUE : GRAY, marginBottom: -2,
          }}>{t}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: GRAY, fontSize: 13 }}>Loading...</div>}

      {/* ═══ OVERVIEW TAB ═══ */}
      {!loading && tab === 0 && overview && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total Revenue', value: fmt(overview.revenue), prev: prevOverview?.revenue, color: GREEN },
              { label: 'Work Orders', value: overview.so_count, prev: prevOverview?.so_count, color: BLUE },
              { label: 'Avg WO Value', value: fmt(overview.so_count ? overview.revenue / overview.so_count : 0), prev: prevOverview?.so_count ? prevOverview?.revenue / prevOverview?.so_count : 0, color: BLUE },
              { label: 'Avg Cycle (hrs)', value: overview.avg_cycle_hours, prev: prevOverview?.avg_cycle_hours, color: AMBER, invert: true },
              { label: 'Parts Inventory', value: fmt(overview.inventory_value), color: GRAY },
              { label: 'Outstanding', value: fmt(overview.outstanding), prev: prevOverview?.outstanding, color: RED, invert: true },
            ].map(c => {
              const change = c.prev != null ? pctChange(typeof c.value === 'string' ? parseFloat(c.value.replace(/[$,]/g, '')) : c.value, c.prev) : null
              const changeColor = change != null ? (c.invert ? (change <= 0 ? GREEN : RED) : (change >= 0 ? GREEN : RED)) : GRAY
              return (
                <div key={c.label} style={{ background: '#FAFBFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A' }}>{c.value}</div>
                  {change != null && (
                    <div style={{ fontSize: 11, color: changeColor, fontWeight: 600, marginTop: 4 }}>
                      {change > 0 ? '+' : ''}{change}% vs previous period
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ REVENUE TAB ═══ */}
      {!loading && tab === 1 && (
        <div>
          {/* Simple bar chart for daily revenue */}
          <div style={{ background: '#FAFBFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Daily Revenue</h3>
            {revenueByDay.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160 }}>
                {revenueByDay.map((d, i) => {
                  const max = Math.max(...revenueByDay.map(r => r.revenue), 1)
                  const h = Math.max(4, (d.revenue / max) * 140)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 8, color: GRAY, whiteSpace: 'nowrap' }}>{fmt(d.revenue)}</div>
                      <div style={{ width: '100%', height: h, background: BLUE, borderRadius: '4px 4px 0 0', minWidth: 6 }} />
                      <div style={{ fontSize: 8, color: GRAY, whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</div>
                    </div>
                  )
                })}
              </div>
            ) : <div style={{ color: GRAY, fontSize: 12, textAlign: 'center', padding: 40 }}>No revenue data for this period</div>}
          </div>

          {/* Top customers table */}
          <div style={{ background: '#FAFBFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Top Customers by Revenue</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>{['Customer', 'Work Orders', 'Revenue'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{c.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{c.wos}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(c.revenue)}</td>
                  </tr>
                ))}
                {topCustomers.length === 0 && <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: GRAY }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ LABOR TAB ═══ */}
      {!loading && tab === 2 && (
        <div>
          {/* Hours bar chart */}
          {laborData.length > 0 && (
            <div style={{ background: '#FAFBFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Hours by Mechanic</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {laborData.map((m, i) => {
                  const max = Math.max(...laborData.map(l => l.hours), 1)
                  const w = Math.max(20, (m.hours / max) * 100)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 120, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{m.name}</div>
                      <div style={{ flex: 1, height: 24, background: '#E5E7EB', borderRadius: 4 }}>
                        <div style={{ width: `${w}%`, height: '100%', background: BLUE, borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                          <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{m.hours.toFixed(1)}h</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Mechanic table */}
          <div style={{ background: '#FAFBFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Mechanic Productivity</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>{['Mechanic', 'Total Hours', 'WOs Completed', 'Avg Hours/WO'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {laborData.map((m, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{m.name}</td>
                    <td style={tdStyle}>{m.hours.toFixed(1)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{m.wos_completed}</td>
                    <td style={tdStyle}>{m.wos_completed ? (m.hours / m.wos_completed).toFixed(1) : '—'}</td>
                  </tr>
                ))}
                {laborData.length === 0 && <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: GRAY }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ PARTS TAB ═══ */}
      {!loading && tab === 3 && (
        <div>
          {/* Top parts bar chart */}
          {partsData.length > 0 && (
            <div style={{ background: '#FAFBFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Top Parts by Quantity Used</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {partsData.slice(0, 10).map((p, i) => {
                  const max = Math.max(...partsData.slice(0, 10).map(pp => pp.qty), 1)
                  const w = Math.max(20, (p.qty / max) * 100)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 180, fontSize: 11, fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>
                      <div style={{ flex: 1, height: 20, background: '#E5E7EB', borderRadius: 4 }}>
                        <div style={{ width: `${w}%`, height: '100%', background: GREEN, borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                          <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>{p.qty}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, width: 70, textAlign: 'right' }}>{fmt(p.revenue)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Parts table */}
          <div style={{ background: '#FAFBFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Parts Usage & Revenue</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>{['Part', 'Qty Used', 'Total Revenue'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {partsData.map((p, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{p.description}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{p.qty}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(p.revenue)}</td>
                  </tr>
                ))}
                {partsData.length === 0 && <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: GRAY }}>No data</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Low stock alerts */}
          {lowStock.length > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: RED }}>Low Stock Alerts</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>{['Part #', 'Description', 'On Hand', 'Reorder Point'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {lowStock.map((p, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{p.part_number || '—'}</td>
                      <td style={tdStyle}>{p.description}</td>
                      <td style={{ ...tdStyle, color: RED, fontWeight: 700, textAlign: 'center' }}>{p.on_hand}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{p.reorder_point}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ TRUCKS TAB ═══ */}
      {!loading && tab === 4 && (
        <div style={{ background: '#FAFBFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Most Serviced Units</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>{['Unit #', 'Company', 'Visits', 'Total Spend', 'Last Service'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {trucksData.map((t, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{t.unit_number}</td>
                  <td style={tdStyle}>{t.company}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{t.visits}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{fmt(t.spend)}</td>
                  <td style={{ ...tdStyle, color: GRAY, fontSize: 12 }}>{t.last_service ? fmtDate(t.last_service) : '—'}</td>
                </tr>
              ))}
              {trucksData.length === 0 && <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: GRAY }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, borderBottom: '1px solid #E5E7EB' }
const tdStyle: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 13 }
