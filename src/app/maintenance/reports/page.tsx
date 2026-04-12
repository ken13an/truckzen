'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

const DATE_PRESETS = [
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: 'Last Month', days: 60 },
  { label: 'Last 3 Months', days: 90 },
  { label: 'This Year', days: 365 },
]

const TABS = ['Overview', 'Cost Per Truck', 'Fuel', 'PM Compliance', 'Driver', 'Vendor Spend', 'Issues & Faults', 'Compliance', 'Warranties', 'Fleet Utilization', 'Service History', 'Inventory & Parts'] as const

export default function MaintReportsPage() {
  const { tokens: th } = useTheme()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [tab, setTab] = useState<typeof TABS[number]>('Overview')
  const [preset, setPreset] = useState(1)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({})

  const days = DATE_PRESETS[preset].days
  const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

  useEffect(() => {
    getCurrentUser(supabase).then(p => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
    })
  }, [])

  useEffect(() => {
    if (!shopId) return
    setLoading(true)
    fetch(`/api/maintenance/reports?shop_id=${shopId}&from=${dateFrom}&tab=${tab}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [shopId, tab, preset])

  const S: Record<string, React.CSSProperties> = {
    card: { background: th.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' },
    th: { fontFamily: MONO, fontSize: 8, color: th.textTertiary, textTransform: 'uppercase', letterSpacing: '.08em', padding: '6px 10px', textAlign: 'left', background: '#0B0D11' },
    td: { padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 12 },
  }

  return (
    <div style={{ background: th.bg, minHeight: '100vh', color: th.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: th.text, marginBottom: 16 }}>Maintenance Reports</div>

      {/* Date range picker */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {DATE_PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => setPreset(i)} style={{
            padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            border: preset === i ? '1px solid rgba(29,111,232,.3)' : '1px solid rgba(255,255,255,.08)',
            background: preset === i ? 'rgba(29,111,232,.1)' : 'transparent',
            color: preset === i ? '#4D9EFF' : MUTED,
          }}>{p.label}</button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 18px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #1B6EE6' : '2px solid transparent',
            color: tab === t ? '#F0F4FF' : MUTED, fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
          }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: MUTED, fontSize: 13 }}>Loading reports...</div>
      ) : (
        <>
          {tab === 'Overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Road Repair Cost', value: `$${(data.repairCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: BLUE },
                { label: 'Fuel Cost', value: `$${(data.fuelCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: GREEN },
                { label: 'Total Expenses', value: `$${(data.expenseCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: AMBER },
                { label: 'Total POs', value: `$${(data.poCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: '#8B5CF6' },
                { label: 'PM Compliance', value: data.pmCompliance ? `${data.pmCompliance}%` : '—', color: (data.pmCompliance || 0) >= 80 ? GREEN : RED },
              ].map(c => (
                <div key={c.label} style={S.card}>
                  <div style={{ fontSize: 10, color: th.textTertiary, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Cost Per Truck' && (
            <div style={{ background: th.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Truck', 'Repairs', 'Fuel', 'Expenses', 'Total'].map(h => <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                <tbody>
                  {(data.trucks || []).length === 0 ? (
                    <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: th.textTertiary }}>No data for this period</td></tr>
                  ) : (data.trucks || []).map((t: any) => (
                    <tr key={t.unit_number}>
                      <td style={{ ...S.td, fontFamily: MONO, color: '#4D9EFF', fontWeight: 700 }}>#{t.unit_number}</td>
                      <td style={{ ...S.td, fontFamily: MONO }}>${(t.repairs || 0).toFixed(0)}</td>
                      <td style={{ ...S.td, fontFamily: MONO }}>${(t.fuel || 0).toFixed(0)}</td>
                      <td style={{ ...S.td, fontFamily: MONO }}>${(t.expenses || 0).toFixed(0)}</td>
                      <td style={{ ...S.td, fontFamily: MONO, fontWeight: 700, color: th.text }}>${(t.total || 0).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Fuel' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Total Fuel Cost', value: `$${(data.totalFuel || 0).toFixed(0)}`, color: BLUE },
                  { label: 'Total Gallons', value: (data.totalGallons || 0).toFixed(0), color: '#8B5CF6' },
                  { label: 'Avg Cost/Gal', value: data.avgCpg ? `$${data.avgCpg.toFixed(3)}` : '—', color: AMBER },
                ].map(c => (
                  <div key={c.label} style={S.card}>
                    <div style={{ fontSize: 10, color: th.textTertiary, fontFamily: MONO, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...S.card, textAlign: 'center', color: th.textTertiary, fontSize: 12, padding: 30 }}>
                Fuel trend charts will display once sufficient data is available.
              </div>
            </div>
          )}

          {tab === 'PM Compliance' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={S.card}>
                  <div style={{ fontSize: 10, color: th.textTertiary, fontFamily: MONO, textTransform: 'uppercase', marginBottom: 4 }}>On Time</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: GREEN }}>{data.onTime || 0}%</div>
                </div>
                <div style={S.card}>
                  <div style={{ fontSize: 10, color: th.textTertiary, fontFamily: MONO, textTransform: 'uppercase', marginBottom: 4 }}>Overdue</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: RED }}>{data.overdueCount || 0}</div>
                </div>
              </div>
              {(data.overdueList || []).length > 0 && (
                <div style={{ background: th.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['Truck', 'Service', 'Days Overdue'].map(h => <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                    <tbody>{(data.overdueList || []).map((p: any, i: number) => (
                      <tr key={i}>
                        <td style={{ ...S.td, fontFamily: MONO, color: '#4D9EFF' }}>#{p.unit_number || '—'}</td>
                        <td style={S.td}>{p.service_type}</td>
                        <td style={{ ...S.td, color: RED, fontWeight: 700 }}>{p.days_overdue}d</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'Driver' && (
            <div style={{ background: th.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Driver', 'Inspections', 'Defects', 'Fuel Entries', 'Repairs'].map(h => <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                <tbody>
                  {(data.drivers || []).length === 0 ? (
                    <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: th.textTertiary }}>No driver data for this period</td></tr>
                  ) : (data.drivers || []).map((d: any) => (
                    <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/maintenance/drivers/${d.id}`}>
                      <td style={{ ...S.td, fontWeight: 600, color: th.text }}>{d.full_name}</td>
                      <td style={{ ...S.td, fontFamily: MONO }}>{d.inspections || 0}</td>
                      <td style={{ ...S.td, fontFamily: MONO, color: (d.defects || 0) > 0 ? RED : th.text }}>{d.defects || 0}</td>
                      <td style={{ ...S.td, fontFamily: MONO }}>{d.fuel_entries || 0}</td>
                      <td style={{ ...S.td, fontFamily: MONO }}>{d.repairs || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Vendor Spend' && (
            <div style={{ background: th.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Vendor', 'Total Spent', 'Repairs', 'Avg Repair Cost'].map(h => <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                <tbody>
                  {(data.vendors || []).length === 0 ? (
                    <tr><td colSpan={4} style={{ ...S.td, textAlign: 'center', color: th.textTertiary }}>No vendor data for this period</td></tr>
                  ) : (data.vendors || []).map((v: any) => (
                    <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/maintenance/vendors/${v.id}`}>
                      <td style={{ ...S.td, fontWeight: 600, color: th.text }}>{v.name}</td>
                      <td style={{ ...S.td, fontFamily: MONO, fontWeight: 700 }}>${(v.total || 0).toFixed(0)}</td>
                      <td style={{ ...S.td, fontFamily: MONO }}>{v.repair_count || 0}</td>
                      <td style={{ ...S.td, fontFamily: MONO }}>${(v.avg_cost || 0).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Issues & Faults' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Open Issues', value: data.openIssues || 0, color: AMBER },
                  { label: 'Open Faults', value: data.openFaults || 0, color: RED },
                  { label: 'Avg Resolution (days)', value: data.avgResolution || '—', color: BLUE },
                ].map(c => (
                  <div key={c.label} style={S.card}><div style={{ fontSize: 10, color: th.textTertiary, fontFamily: MONO, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div><div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div></div>
                ))}
              </div>
              {(data.topFaults || []).length > 0 && (
                <div style={{ background: th.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: th.text }}>Top Fault Codes</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Code', 'Count', 'Severity'].map(h => <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                    <tbody>{(data.topFaults || []).map((f: any, i: number) => (<tr key={i}><td style={{ ...S.td, fontFamily: MONO, color: BLUE }}>{f.fault_code}</td><td style={{ ...S.td, fontFamily: MONO, fontWeight: 700 }}>{f.count}</td><td style={S.td}>{f.severity}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'Compliance' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Service Reminders', overdue: data.srOverdue || 0, ok: data.srOk || 0 },
                { label: 'Vehicle Renewals', overdue: data.vrOverdue || 0, ok: data.vrOk || 0 },
                { label: 'Contact Renewals', overdue: data.crOverdue || 0, ok: data.crOk || 0 },
              ].map(c => {
                const total = c.overdue + c.ok
                const pct = total > 0 ? Math.round((c.ok / total) * 100) : 0
                return (
                  <div key={c.label} style={S.card}>
                    <div style={{ fontSize: 10, color: th.textTertiary, fontFamily: MONO, textTransform: 'uppercase', marginBottom: 8 }}>{c.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED }}>{pct}%</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{c.overdue} overdue · {c.ok} on time</div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'Warranties' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Active Warranties', value: data.activeWarranties || 0, color: GREEN },
                  { label: 'Total Claimed', value: `$${(data.totalClaimed || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: BLUE },
                  { label: 'Claims This Period', value: data.claimsCount || 0, color: AMBER },
                ].map(c => (
                  <div key={c.label} style={S.card}><div style={{ fontSize: 10, color: th.textTertiary, fontFamily: MONO, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div><div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div></div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Fleet Utilization' && (
            <div style={S.card}>
              <div style={{ textAlign: 'center', padding: 30, color: th.textTertiary, fontSize: 13 }}>
                Fleet utilization metrics will display once vehicle status and location data is available. Track days on road, in shop, and idle per truck.
              </div>
            </div>
          )}

          {tab === 'Service History' && (
            <div style={S.card}>
              <div style={{ textAlign: 'center', padding: 30, color: th.textTertiary, fontSize: 13 }}>
                Service history will display once maintenance records are entered. View all services grouped by vehicle with costs and frequency.
              </div>
            </div>
          )}

          {tab === 'Inventory & Parts' && (
            <div style={S.card}>
              <div style={{ textAlign: 'center', padding: 30, color: th.textTertiary, fontSize: 13 }}>
                Inventory reports will display once parts data is available. Track parts usage, inventory value, and low stock alerts.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
