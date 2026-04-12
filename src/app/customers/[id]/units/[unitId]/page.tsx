'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ChevronLeft } from 'lucide-react'
import { VinInput } from '@/components/shared/VinInput'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import { getWorkorderRoute, getNewWorkorderRoute } from '@/lib/navigation/workorder-route'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = '#1D6FE8', GREEN = '#16A34A', RED = '#DC2626', AMBER = '#D97706', GRAY = '#6B7280'
const TABS = ['Service History', 'Maintenance', 'Parts History', 'Details']
const UNIT_TYPE_LABEL: Record<string, string> = {
  tractor: 'TRACTOR',
  trailer_dry_van: 'TRAILER — Dry Van',
  trailer_reefer: 'TRAILER — Reefer',
  trailer_flatbed: 'TRAILER — Flatbed',
  trailer_tanker: 'TRAILER — Tanker',
  trailer_lowboy: 'TRAILER — Lowboy',
  trailer_other: 'TRAILER — Other',
}
const cardStyle: React.CSSProperties = { background: '#151520', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 13, color: '#EDEDF0', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4, marginTop: 10 }
const pillStyle = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: bg, color })

export default function UnitProfilePage() {
  const { tokens: th } = useTheme()
  const params = useParams()
  const id = params.id as string
  const unitId = params.unitId as string
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [unit, setUnit] = useState<any | null>(null)
  const [customer, setCustomer] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [activeWO, setActiveWO] = useState<any | null>(null)
  const [woParts, setWoParts] = useState<any[]>([])
  const [woLines, setWoLines] = useState<any[]>([])
  const [editForm, setEditForm] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) return
      setUser(profile)

      const shopId = profile.shop_id

      const [unitData, custData, allWos] = await Promise.all([
        fetch(`/api/assets/${unitId}`).then((r) => r.ok ? r.json() : null),
        fetch(`/api/customers/${id}?shop_id=${shopId}`).then((r) => r.ok ? r.json() : null),
        fetch(`/api/service-orders?shop_id=${shopId}&limit=200`).then((r) => r.ok ? r.json() : []),
      ])

      if (unitData) {
        setUnit(unitData)
        setEditForm({ ...unitData })
      }
      if (custData) setCustomer(custData)

      // Filter work orders for this specific asset client-side
      // The API returns assets as a nested object { id, ... }, not a flat asset_id field
      const wos: any[] = (Array.isArray(allWos) ? allWos : []).filter(
        (w: any) => w.assets?.id === unitId || w.asset_id === unitId
      )
      // The API already excludes deleted_at and void; re-sort descending by created_at
      wos.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setWorkOrders(wos)

      const woIds = wos.map((w: any) => w.id)

      if (woIds.length > 0) {
        const [linesArrays, partsRes] = await Promise.all([
          Promise.all(woIds.map((soId: string) =>
            fetch(`/api/so-lines?so_id=${soId}`).then((r) => r.ok ? r.json() : [])
          )),
          supabase.from('wo_parts').select('*, so_lines(description), service_orders(so_number, created_at)').in('wo_id', woIds),
        ])
        setWoLines((linesArrays as any[][]).flat())
        setWoParts(partsRes.data || [])
      }

      const active = wos.find(
        (w: any) =>
          !['done', 'completed', 'invoiced', 'closed'].includes(w.wo_status) ||
          !['good_to_go', 'done', 'void'].includes(w.status)
      )
      setActiveWO(active || null)

      setLoading(false)
    }
    load()
  }, [id, unitId])

  /* helpers */
  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  function fmtMoney(v: number | null) {
    if (v == null) return '$0.00'
    return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  function statusColor(s: string | null) {
    if (!s) return { bg: 'rgba(107,114,128,0.15)', fg: GRAY }
    const low = s.toLowerCase()
    if (['done', 'completed', 'good_to_go', 'invoiced', 'closed'].includes(low)) return { bg: 'rgba(22,163,74,0.15)', fg: GREEN }
    if (['in_progress', 'assigned', 'open', 'pending'].includes(low)) return { bg: 'rgba(29,111,232,0.15)', fg: BLUE }
    if (['void', 'cancelled'].includes(low)) return { bg: 'rgba(220,38,38,0.15)', fg: RED }
    return { bg: 'rgba(217,119,6,0.15)', fg: AMBER }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: th.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ color: GRAY, fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (!unit) {
    return (
      <div style={{ minHeight: '100vh', background: th.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ color: GRAY, fontSize: 14 }}>Unit not found.</div>
      </div>
    )
  }

  const isTrailer = (unit.unit_type || '').startsWith('trailer')
  const typeBadgeColor = isTrailer ? AMBER : BLUE
  const typeLabel = UNIT_TYPE_LABEL[unit.unit_type] || (unit.unit_type || 'UNKNOWN').toUpperCase()

  const totalSpend = workOrders.reduce((s: number, w: any) => s + (Number(w.grand_total) || 0), 0)
  const lastService = workOrders.length > 0 ? workOrders[0].created_at : null

  const vinDisplay = (vin: string | null) => {
    if (!vin) return <span style={{ color: GRAY }}>—</span>
    if (vin.length <= 6) return <span style={{ fontWeight: 700 }}>{vin}</span>
    return (
      <>
        <span style={{ color: GRAY }}>{vin.slice(0, -6)}</span>
        <span style={{ fontWeight: 700, color: th.text }}>{vin.slice(-6)}</span>
      </>
    )
  }

  /* Save details */
  async function saveDetails() {
    if (!editForm) return
    setSaving(true)
    const { error } = await supabase.from('assets').update({
      unit_number: editForm.unit_number,
      vin: editForm.vin,
      year: editForm.year ? Number(editForm.year) : null,
      make: editForm.make,
      model: editForm.model,
      unit_type: editForm.unit_type,
      ownership_type: editForm.ownership_type,
      license_plate: editForm.license_plate,
      state: editForm.state,
      odometer: editForm.odometer ? Number(editForm.odometer) : null,
      warranty_start: editForm.warranty_start || null,
      warranty_end: editForm.warranty_end || null,
      warranty_notes: editForm.warranty_notes || null,
      is_owner_operator: editForm.is_owner_operator || false,
    }).eq('id', unitId)
    if (!error) {
      setUnit({ ...unit, ...editForm })
    }
    setSaving(false)
  }

  /* Deactivate */
  async function deactivateUnit() {
    if (!confirm('Deactivate this unit? It will be hidden from fleet views.')) return
    const { error } = await supabase.from('assets').update({ active: false }).eq('id', unitId)
    if (!error) {
      window.location.href = '/customers/' + id
    }
  }

  /* Maintenance calculation */
  function getMaintenanceItems() {
    const rules = [
      { keyword: 'oil', label: 'Oil Change', mileageInterval: 25000, monthInterval: null },
      { keyword: 'dot', label: 'DOT Inspection', mileageInterval: null, monthInterval: 12 },
      { keyword: 'tire', label: 'Tire Replacement', mileageInterval: 100000, monthInterval: null },
      { keyword: 'def', label: 'DEF Service', mileageInterval: 50000, monthInterval: null },
    ]
    return rules.map((rule) => {
      const matchingWOs = workOrders.filter((wo: any) => {
        const lines = woLines.filter((l: any) => l.so_id === wo.id)
        return lines.some((l: any) => (l.description || '').toLowerCase().includes(rule.keyword))
      })
      const lastWO = matchingWOs.length > 0 ? matchingWOs[0] : null
      let nextDue: string | null = null
      let status: 'ok' | 'due_soon' | 'overdue' | 'unknown' = 'unknown'

      if (lastWO && rule.mileageInterval) {
        const lastMi = Number(lastWO.mileage_at_checkin) || 0
        const nextMi = lastMi + rule.mileageInterval
        const currentMi = Number(unit.odometer) || 0
        nextDue = nextMi.toLocaleString() + ' mi'
        if (currentMi >= nextMi) status = 'overdue'
        else if (currentMi >= nextMi - rule.mileageInterval * 0.1) status = 'due_soon'
        else status = 'ok'
      } else if (lastWO && rule.monthInterval) {
        const lastDate = new Date(lastWO.created_at)
        const nextDate = new Date(lastDate)
        nextDate.setMonth(nextDate.getMonth() + rule.monthInterval)
        nextDue = fmtDate(nextDate.toISOString())
        const now = new Date()
        if (now >= nextDate) status = 'overdue'
        else {
          const warnDate = new Date(nextDate)
          warnDate.setMonth(warnDate.getMonth() - 1)
          if (now >= warnDate) status = 'due_soon'
          else status = 'ok'
        }
      }

      return { ...rule, lastWO, nextDue, status }
    })
  }

  function getRecurringIssues() {
    const keywords = ['brake', 'engine', 'oil', 'transmission', 'electrical', 'tire', 'ac', 'suspension', 'coolant', 'def']
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
    const recentWOs = workOrders.filter((w: any) => new Date(w.created_at) >= twelveMonthsAgo)
    const recentWOIds = recentWOs.map((w: any) => w.id)
    const recentLines = woLines.filter((l: any) => recentWOIds.includes(l.so_id))

    const issues: { keyword: string; count: number }[] = []
    keywords.forEach((kw) => {
      const count = recentLines.filter((l: any) => (l.description || '').toLowerCase().includes(kw)).length
      if (count >= 3) issues.push({ keyword: kw, count })
    })
    return issues
  }

  /* Tab content renderers */
  function renderServiceHistory() {
    if (workOrders.length === 0) {
      return <div style={{ ...cardStyle, textAlign: 'center', color: GRAY, padding: 40 }}>No service history yet.</div>
    }
    return workOrders.map((wo: any) => {
      const lines = woLines.filter((l: any) => l.so_id === wo.id)
      const firstLine = lines[0]
      const sc = statusColor(wo.wo_status || wo.status)
      const isExpanded = expanded === wo.id
      return (
        <div key={wo.id} style={{ ...cardStyle, cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : wo.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: GRAY }}>{fmtDate(wo.created_at)}</span>
              <a
                href={getWorkorderRoute(wo.id, undefined, 'customer')}
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 13, fontWeight: 600, color: BLUE, textDecoration: 'none' }}
              >
                {wo.so_number}
              </a>
              <span style={pillStyle(sc.bg, sc.fg)}>{(wo.wo_status || wo.status || 'unknown').replace(/_/g, ' ').toUpperCase()}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{fmtMoney(wo.grand_total)}</span>
          </div>
          {firstLine && (
            <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{firstLine.description || firstLine.concern || '—'}</div>
          )}
          {isExpanded && lines.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
              {lines.map((line: any, i: number) => (
                <div key={line.id || i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: th.text, marginBottom: 2 }}>{line.description || 'Line ' + (i + 1)}</div>
                  {line.concern && <div style={{ fontSize: 11, color: GRAY }}><span style={{ fontWeight: 600, color: AMBER }}>Concern:</span> {line.concern}</div>}
                  {line.finding && <div style={{ fontSize: 11, color: GRAY }}><span style={{ fontWeight: 600, color: BLUE }}>Finding:</span> {line.finding}</div>}
                  {line.resolution && <div style={{ fontSize: 11, color: GRAY }}><span style={{ fontWeight: 600, color: GREEN }}>Resolution:</span> {line.resolution}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    })
  }

  function renderMaintenance() {
    const items = getMaintenanceItems()
    const issues = getRecurringIssues()
    const hasData = workOrders.length > 0

    if (!hasData) {
      return <div style={{ ...cardStyle, textAlign: 'center', color: GRAY, padding: 40 }}>No maintenance data available.</div>
    }

    return (
      <>
        {items.map((item, i) => {
          let statusLabel = 'Unknown'
          let statusBg = 'rgba(107,114,128,0.15)'
          let statusFg = GRAY
          if (item.status === 'ok') { statusLabel = 'OK'; statusBg = 'rgba(22,163,74,0.15)'; statusFg = GREEN }
          if (item.status === 'due_soon') { statusLabel = 'Due Soon'; statusBg = 'rgba(217,119,6,0.15)'; statusFg = AMBER }
          if (item.status === 'overdue') { statusLabel = 'Overdue'; statusBg = 'rgba(220,38,38,0.15)'; statusFg = RED }

          return (
            <div key={i} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: th.text }}>{item.label}</span>
                <span style={pillStyle(statusBg, statusFg)}>{statusLabel}</span>
              </div>
              <div style={{ fontSize: 12, color: GRAY }}>
                {item.lastWO ? (
                  <>Last performed: {fmtDate(item.lastWO.created_at)} — WO <a href={getWorkorderRoute(item.lastWO.id, undefined, 'customer')} style={{ color: BLUE, textDecoration: 'none' }}>{item.lastWO.so_number}</a>{item.lastWO.mileage_at_checkin ? ` at ${Number(item.lastWO.mileage_at_checkin).toLocaleString()} mi` : ''}</>
                ) : (
                  'No records found'
                )}
              </div>
              {item.nextDue && (
                <div style={{ fontSize: 12, color: th.text, marginTop: 4 }}>Next due: {item.nextDue}</div>
              )}
            </div>
          )
        })}

        {issues.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: AMBER, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recurring Issues (Last 12 Months)</div>
            {issues.map((issue, i) => (
              <div key={i} style={{ ...cardStyle, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: AMBER, textTransform: 'capitalize' }}>{issue.keyword}</span>
                  <span style={pillStyle('rgba(217,119,6,0.15)', AMBER)}>{issue.count} occurrences</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  function renderPartsHistory() {
    if (woParts.length === 0) {
      return <div style={{ ...cardStyle, textAlign: 'center', color: GRAY, padding: 40 }}>No parts history.</div>
    }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Date', 'WO #', 'Part #', 'Description', 'Qty', 'Cost', 'Status'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: GRAY, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {woParts.map((p: any, i: number) => {
              const sc = statusColor(p.status)
              return (
                <tr key={p.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 10px', color: GRAY }}>{p.service_orders ? fmtDate(p.service_orders.created_at) : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {p.service_orders ? (
                      <a href={getWorkorderRoute(p.wo_id, undefined, 'customer')} style={{ color: BLUE, textDecoration: 'none', fontWeight: 600 }}>{p.service_orders.so_number}</a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', color: th.text, fontFamily: 'monospace' }}>{p.part_number || '—'}</td>
                  <td style={{ padding: '8px 10px', color: th.text }}>{p.so_lines?.description || p.description || '—'}</td>
                  <td style={{ padding: '8px 10px', color: th.text }}>{p.quantity ?? '—'}</td>
                  <td style={{ padding: '8px 10px', color: th.text }}>{p.cost != null ? fmtMoney(p.cost) : '—'}</td>
                  <td style={{ padding: '8px 10px' }}><span style={pillStyle(sc.bg, sc.fg)}>{(p.status || 'unknown').replace(/_/g, ' ').toUpperCase()}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  function renderDetails() {
    if (!editForm) return null
    const isUnderWarranty = editForm.warranty_end && new Date(editForm.warranty_end) >= new Date()
    return (
      <div>
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: th.text, marginBottom: 4 }}>Unit Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div>
              <label style={labelStyle}>Unit Number</label>
              <input style={inputStyle} value={editForm.unit_number || ''} onChange={(e) => setEditForm({ ...editForm, unit_number: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>VIN</label>
              <VinInput
                value={editForm.vin || ''}
                onChange={(v) => setEditForm({ ...editForm, vin: v })}
                onDecode={(result) => {
                  setEditForm((prev: any) => ({
                    ...prev,
                    ...(result.year ? { year: String(result.year) } : {}),
                    ...(result.make ? { make: result.make } : {}),
                    ...(result.model ? { model: result.model } : {}),
                  }))
                }}
                theme="dark"
              />
            </div>
            <div>
              <label style={labelStyle}>Year</label>
              <input style={inputStyle} type="number" value={editForm.year || ''} onChange={(e) => setEditForm({ ...editForm, year: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Make</label>
              <input style={inputStyle} value={editForm.make || ''} onChange={(e) => setEditForm({ ...editForm, make: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Model</label>
              <input style={inputStyle} value={editForm.model || ''} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Unit Type</label>
              <select
                style={{ ...inputStyle, appearance: 'none' } as React.CSSProperties}
                value={editForm.unit_type || ''}
                onChange={(e) => setEditForm({ ...editForm, unit_type: e.target.value })}
              >
                <option value="">Select…</option>
                {Object.entries(UNIT_TYPE_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ownership Type</label>
              <select
                style={{ ...inputStyle, appearance: 'none' } as React.CSSProperties}
                value={editForm.ownership_type || ''}
                onChange={(e) => setEditForm({ ...editForm, ownership_type: e.target.value })}
              >
                <option value="">Select…</option>
                <option value="owned">Owned</option>
                <option value="leased">Leased</option>
                <option value="rented">Rented</option>
                <option value="customer">Customer-Owned</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>License Plate</label>
              <input style={inputStyle} value={editForm.license_plate || ''} onChange={(e) => setEditForm({ ...editForm, license_plate: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <input style={inputStyle} value={editForm.state || ''} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <button
                onClick={() => setEditForm({ ...editForm, is_owner_operator: !editForm.is_owner_operator })}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  border: 'none',
                  background: editForm.is_owner_operator ? AMBER : th.border,
                  cursor: 'pointer',
                  position: 'relative' as const,
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: '#fff',
                  position: 'absolute' as const,
                  top: 3,
                  left: editForm.is_owner_operator ? 19 : 3,
                  transition: 'left 0.2s',
                }} />
              </button>
              <span style={{ fontSize: 12, color: th.text }}>Owner Operator Truck</span>
            </div>
            <div>
              <label style={labelStyle}>Odometer</label>
              <input style={inputStyle} type="number" value={editForm.odometer || ''} onChange={(e) => setEditForm({ ...editForm, odometer: e.target.value })} />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: th.text }}>Warranty</span>
            {isUnderWarranty && <span style={pillStyle('rgba(22,163,74,0.15)', GREEN)}>Under Warranty</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div>
              <label style={labelStyle}>Warranty Start</label>
              <input style={inputStyle} type="date" value={editForm.warranty_start || ''} onChange={(e) => setEditForm({ ...editForm, warranty_start: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Warranty End</label>
              <input style={inputStyle} type="date" value={editForm.warranty_end || ''} onChange={(e) => setEditForm({ ...editForm, warranty_end: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Warranty Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' } as React.CSSProperties}
              value={editForm.warranty_notes || ''}
              onChange={(e) => setEditForm({ ...editForm, warranty_notes: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button
            onClick={deactivateUnit}
            style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.1)', color: RED, cursor: 'pointer', fontFamily: FONT }}
          >
            Deactivate Unit
          </button>
          <button
            onClick={saveDetails}
            disabled={saving}
            style={{ padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: BLUE, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: FONT }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: th.bg, color: th.text, fontFamily: FONT }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* Back button */}
        <a
          href={'/customers/' + id}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 100, background: th.border, color: th.text, textDecoration: 'none', fontSize: 13, fontWeight: 500, marginBottom: 20 }}
        >
          <ChevronLeft size={14} />
          {customer?.company_name || 'Customer'}
        </a>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: th.text }}>{unit.unit_number || '—'}</span>
            <span style={pillStyle(isTrailer ? 'rgba(217,119,6,0.15)' : 'rgba(29,111,232,0.15)', typeBadgeColor)}>{typeLabel}</span>
            {unit.is_owner_operator && (
              <span style={pillStyle('rgba(217,119,6,0.15)', AMBER)}>OWNER OPERATOR</span>
            )}
          </div>
          <div style={{ fontSize: 16, color: th.text, marginBottom: 4 }}>
            {[unit.year, unit.make, unit.model].filter(Boolean).join(' ') || '—'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, fontSize: 12, color: GRAY, marginTop: 6 }}>
            <span>VIN: {vinDisplay(unit.vin)}</span>
            {(unit.ownership_type || unit.is_owner_operator) && <OwnershipTypeBadge type={unit.is_owner_operator ? 'owner_operator' : unit.ownership_type} />}
            {unit.odometer != null && (
              <span>{Number(unit.odometer).toLocaleString()} mi</span>
            )}
            {unit.license_plate && (
              <span>{unit.license_plate}{unit.state ? ' · ' + unit.state : ''}</span>
            )}
          </div>
        </div>

        {/* Active WO Alert */}
        {activeWO ? (
          <div style={{ ...cardStyle, background: 'rgba(29,111,232,0.1)', border: '1px solid rgba(29,111,232,0.25)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ color: th.text, fontWeight: 600 }}>Active Work Order:</span>
              <a href={getWorkorderRoute(activeWO.id, undefined, 'customer')} style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}>
                {activeWO.so_number}
              </a>
              <span style={{ color: GRAY }}>—</span>
              <span style={pillStyle(statusColor(activeWO.wo_status || activeWO.status).bg, statusColor(activeWO.wo_status || activeWO.status).fg)}>
                {(activeWO.wo_status || activeWO.status || '').replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
          </div>
        ) : (
          <a
            href={getNewWorkorderRoute({ customer: id as string, unit: unitId as string })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, background: BLUE, color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 16 }}
          >
            + Create Work Order
          </a>
        )}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Services</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: th.text }}>{workOrders.length}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Spend</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: th.text }}>{fmtMoney(totalSpend)}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Last Service</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: th.text }}>{lastService ? fmtDate(lastService) : 'Never'}</div>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                color: tab === i ? BLUE : GRAY,
                background: 'none',
                border: 'none',
                borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: FONT,
                marginBottom: -1,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 0 && renderServiceHistory()}
        {tab === 1 && renderMaintenance()}
        {tab === 2 && renderPartsHistory()}
        {tab === 3 && renderDetails()}

      </div>
    </div>
  )
}
