'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

type Tab = 'fleet' | 'inventory' | 'costs' | 'alerts'
type Modal = null | 'install' | 'tread' | 'pressure' | 'rotate' | 'remove' | 'price'

const POSITIONS = [
  { key: 'steer_left', label: 'Steer L', short: 'SL' },
  { key: 'steer_right', label: 'Steer R', short: 'SR' },
  { key: 'drive_outer_left', label: 'Drive OL', short: 'DOL' },
  { key: 'drive_inner_left', label: 'Drive IL', short: 'DIL' },
  { key: 'drive_inner_right', label: 'Drive IR', short: 'DIR' },
  { key: 'drive_outer_right', label: 'Drive OR', short: 'DOR' },
  { key: 'trailer_outer_left', label: 'Trailer OL', short: 'TOL' },
  { key: 'trailer_inner_left', label: 'Trailer IL', short: 'TIL' },
  { key: 'trailer_inner_right', label: 'Trailer IR', short: 'TIR' },
  { key: 'trailer_outer_right', label: 'Trailer OR', short: 'TOR' },
  { key: 'spare', label: 'Spare', short: 'SP' },
]

function lifeColor(pct: number) { return pct > 20 ? '#22C55E' : pct > 10 ? '#F59E0B' : '#EF4444' }
function lifeBg(pct: number) { return pct > 20 ? 'rgba(34,197,94,.08)' : pct > 10 ? 'rgba(245,158,11,.08)' : 'rgba(239,68,68,.08)' }

export default function TireTrackerPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('fleet')
  const [fleet, setFleet] = useState<any[]>([])
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [assetTires, setAssetTires] = useState<any[]>([])
  const [allTires, setAllTires] = useState<any[]>([])
  const [prices, setPrices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>(null)
  const [modalTire, setModalTire] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  // Form state
  const [f, setF] = useState<any>({})
  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadFleet = useCallback(async (shopId: string) => {
    const res = await fetch(`/api/tires?shop_id=${shopId}&view=fleet`)
    const data = await res.json()
    setFleet(Array.isArray(data) ? data : [])
  }, [])

  const loadAssetTires = useCallback(async (shopId: string, assetId: string) => {
    const res = await fetch(`/api/tires?shop_id=${shopId}&asset_id=${assetId}&status=all`)
    const data = await res.json()
    setAssetTires(Array.isArray(data) ? data : [])
  }, [])

  const loadPrices = useCallback(async (shopId: string) => {
    const { data } = await supabase.from('tire_vendor_prices').select('*').eq('shop_id', shopId).order('quoted_at', { ascending: false }).limit(100)
    setPrices(data || [])
  }, [supabase])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadFleet(p.shop_id)
      setLoading(false)
    })
  }, [])

  // ── API CALLS ────────────────────────────────────────────
  async function apiCall(body: any) {
    setSaving(true)
    const res = await fetch('/api/tires', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, shop_id: user.shop_id }) })
    const data = await res.json()
    setSaving(false)
    return { ok: res.ok, data }
  }

  async function installTire() {
    if (!f.asset_id || !f.position) return
    const { ok } = await apiCall({ action: 'install', ...f })
    if (ok) {
      flash('Tire installed')
      setModal(null); setF({})
      if (selectedAsset) await loadAssetTires(user.shop_id, selectedAsset.id)
      await loadFleet(user.shop_id)
    }
  }

  async function logTread() {
    if (!modalTire || !f.tread_depth) return
    await apiCall({ action: 'log_tread', tire_id: modalTire.id, tread_depth: parseFloat(f.tread_depth), mileage: parseInt(f.mileage) || null, measured_by: user.id })
    flash('Tread depth logged')
    setModal(null); setF({})
    if (selectedAsset) await loadAssetTires(user.shop_id, selectedAsset.id)
  }

  async function logPressure() {
    if (!modalTire || !f.psi) return
    await apiCall({ action: 'log_pressure', tire_id: modalTire.id, asset_id: modalTire.asset_id, psi: parseFloat(f.psi), target_psi: parseFloat(f.target_psi) || 100, logged_by: user.id })
    flash('Pressure logged')
    setModal(null); setF({})
  }

  async function removeTire() {
    if (!modalTire) return
    await apiCall({ action: 'remove', tire_id: modalTire.id, removed_mileage: parseInt(f.removed_mileage) || null, removal_reason: f.removal_reason || 'removed', failure_notes: f.failure_notes })
    flash('Tire removed')
    setModal(null); setF({})
    if (selectedAsset) await loadAssetTires(user.shop_id, selectedAsset.id)
    await loadFleet(user.shop_id)
  }

  async function addPrice() {
    if (!f.vendor || !f.brand || !f.size || !f.price) return
    await apiCall({ action: 'add_price', vendor: f.vendor, brand: f.brand, model: f.model, size: f.size, is_recap: f.is_recap || false, price: parseFloat(f.price) })
    flash('Price recorded')
    setModal(null); setF({})
    await loadPrices(user.shop_id)
  }

  // ── HELPERS ──────────────────────────────────────────────
  function tireLife(tire: any, odo: number) {
    const used = Math.max(0, odo - (tire.install_mileage || 0))
    const remaining = Math.max(0, (tire.expected_life || 100000) - used)
    const pct = Math.round((remaining / (tire.expected_life || 100000)) * 100)
    return { used, remaining, pct }
  }

  function treadStatus(tire: any) {
    const depth = tire.current_tread || 0
    const min = tire.legal_min_tread || 2
    if (depth <= min) return { color: '#EF4444', label: 'ILLEGAL' }
    if (depth <= min + 2) return { color: '#F59E0B', label: 'LOW' }
    return { color: '#22C55E', label: 'OK' }
  }

  function costPerMile(tire: any, odo: number) {
    const used = Math.max(1, odo - (tire.install_mileage || 0))
    return (tire.cost || 0) / used
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0' }}>Loading...</div>

  const filteredFleet = fleet.filter(a => {
    if (search && !a.unit_number?.toLowerCase().includes(search.toLowerCase()) && !(a.customers as any)?.company_name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'green') return a.worst_life_pct > 20
    if (filter === 'yellow') return a.worst_life_pct > 10 && a.worst_life_pct <= 20
    if (filter === 'red') return a.worst_life_pct <= 10
    return true
  })

  // Alerts
  const alerts: { type: string; msg: string; color: string; assetId?: string }[] = []
  for (const a of fleet) {
    for (const t of a.tires || []) {
      const { remaining } = tireLife(t, a.odometer || 0)
      if (remaining <= 10000 && remaining > 0) alerts.push({ type: 'mileage', msg: `#${a.unit_number} ${POSITIONS.find(p => p.key === t.position)?.short || t.position}: ${remaining.toLocaleString()} mi remaining`, color: '#F59E0B', assetId: a.id })
      if (remaining <= 0) alerts.push({ type: 'expired', msg: `#${a.unit_number} ${POSITIONS.find(p => p.key === t.position)?.short || t.position}: PAST expected life`, color: '#EF4444', assetId: a.id })
      const ts = treadStatus(t)
      if (ts.label === 'ILLEGAL') alerts.push({ type: 'tread', msg: `#${a.unit_number} ${POSITIONS.find(p => p.key === t.position)?.short}: Tread ${t.current_tread}/32" — BELOW LEGAL MIN`, color: '#EF4444', assetId: a.id })
    }
  }

  return (
    <div style={S.page}>
      {/* Toast */}
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#00E0B0', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={S.title}>Tire Tracker</div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>{fleet.length} units · {fleet.reduce((s, a) => s + (a.tire_count || 0), 0)} active tires · {alerts.length} alerts</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0D0F12', borderRadius: 10, padding: 4 }}>
        {([['fleet', 'Fleet'], ['inventory', 'All Tires'], ['costs', 'Costs'], ['alerts', 'Alerts']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setSelectedAsset(null); if (k === 'costs') loadPrices(user.shop_id) }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === k ? '#1A1D23' : 'transparent', color: tab === k ? '#F0F4FF' : '#48536A' }}>
            {l} {k === 'alerts' && alerts.length > 0 ? `(${alerts.length})` : ''}
          </button>
        ))}
      </div>

      {/* FLEET VIEW */}
      {tab === 'fleet' && !selectedAsset && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit # or customer..."
              style={{ ...S.input, flex: 1 }} />
            <select value={filter} onChange={e => setFilter(e.target.value as any)} style={{ ...S.input, width: 130 }}>
              <option value="all">All</option>
              <option value="green">Healthy</option>
              <option value="yellow">Warning</option>
              <option value="red">Critical</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {filteredFleet.map(a => (
              <div key={a.id} onClick={() => { setSelectedAsset(a); loadAssetTires(user.shop_id, a.id) }}
                style={{ ...S.card, cursor: 'pointer', borderColor: `${lifeColor(a.worst_life_pct)}20` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF' }}>#{a.unit_number}</div>
                    <div style={{ fontSize: 11, color: '#7C8BA0' }}>{a.year} {a.make} {a.model}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: lifeColor(a.worst_life_pct) }}>{a.worst_life_pct}%</div>
                    <div style={{ fontSize: 9, color: '#48536A', textTransform: 'uppercase' }}>Worst tire</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#7C8BA0' }}>
                  <span>{a.tire_count} tires</span>
                  <span>{(a.odometer || 0).toLocaleString()} mi</span>
                  <span>${(a.total_tire_cost || 0).toLocaleString()}</span>
                </div>
                {/* Mini life bar */}
                <div style={{ marginTop: 8, height: 4, background: '#1A1D23', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${a.worst_life_pct}%`, height: '100%', background: lifeColor(a.worst_life_pct), borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ASSET DETAIL VIEW */}
      {tab === 'fleet' && selectedAsset && (
        <>
          <button onClick={() => setSelectedAsset(null)} style={{ background: 'none', border: 'none', color: '#00E0B0', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 16 }}>← Back to fleet</button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF' }}>#{selectedAsset.unit_number}</div>
              <div style={{ fontSize: 13, color: '#7C8BA0' }}>{selectedAsset.year} {selectedAsset.make} {selectedAsset.model} · {(selectedAsset.odometer || 0).toLocaleString()} mi</div>
            </div>
            <button onClick={() => { setModal('install'); setF({ asset_id: selectedAsset.id, install_mileage: selectedAsset.odometer || 0 }) }} style={S.btn}>+ Install Tire</button>
          </div>

          {/* Tire position grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10, marginBottom: 20 }}>
            {POSITIONS.map(pos => {
              const tire = assetTires.find(t => t.position === pos.key && t.status === 'active')
              if (!tire) return (
                <div key={pos.key} style={{ ...S.card, borderStyle: 'dashed', opacity: 0.5, textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#48536A' }}>{pos.label}</div>
                  <div style={{ fontSize: 11, color: '#48536A', marginTop: 4 }}>Empty</div>
                </div>
              )

              const life = tireLife(tire, selectedAsset.odometer || 0)
              const tread = treadStatus(tire)
              const cpm = costPerMile(tire, selectedAsset.odometer || 0)

              return (
                <div key={pos.key} style={{ ...S.card, background: lifeBg(life.pct), borderColor: `${lifeColor(life.pct)}20` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#7C8BA0', textTransform: 'uppercase' }}>{pos.label}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: lifeColor(life.pct) }}>{life.pct}%</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF' }}>{tire.brand} {tire.model || ''}</div>
                  <div style={{ fontSize: 11, color: '#7C8BA0', marginTop: 2 }}>{tire.size} {tire.is_recap ? '· RECAP' : ''}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 8, fontSize: 10, color: '#7C8BA0' }}>
                    <div>Tread: <span style={{ color: tread.color, fontWeight: 600 }}>{tire.current_tread}/32"</span></div>
                    <div>Remaining: <span style={{ fontWeight: 600 }}>{life.remaining.toLocaleString()}</span></div>
                    <div>CPM: <span style={{ fontWeight: 600 }}>${cpm.toFixed(3)}</span></div>
                  </div>
                  {/* Life bar */}
                  <div style={{ marginTop: 6, height: 3, background: '#1A1D23', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${life.pct}%`, height: '100%', background: lifeColor(life.pct), borderRadius: 2 }} />
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => { setModalTire(tire); setModal('tread'); setF({}) }} style={S.smallBtn}>Tread</button>
                    <button onClick={() => { setModalTire(tire); setModal('pressure'); setF({}) }} style={S.smallBtn}>PSI</button>
                    <button onClick={() => { setModalTire(tire); setModal('remove'); setF({}) }} style={{ ...S.smallBtn, color: '#EF4444', borderColor: '#EF4444' }}>Remove</button>
                  </div>
                  {tire.qr_token && <div style={{ fontSize: 9, color: '#48536A', marginTop: 6 }}>QR: {tire.qr_token}</div>}
                </div>
              )
            })}
          </div>

          {/* History: removed tires */}
          {assetTires.filter(t => t.status !== 'active').length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={S.sectionLabel}>Removed / Failed Tires</div>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Position</th><th style={S.th}>Brand</th><th style={S.th}>Miles Used</th><th style={S.th}>CPM</th><th style={S.th}>Status</th><th style={S.th}>Reason</th>
                </tr></thead>
                <tbody>
                  {assetTires.filter(t => t.status !== 'active').map(t => {
                    const used = (t.removed_mileage || 0) - (t.install_mileage || 0)
                    return (
                      <tr key={t.id}>
                        <td style={S.td}>{POSITIONS.find(p => p.key === t.position)?.short || t.position}</td>
                        <td style={S.td}>{t.brand} {t.size}</td>
                        <td style={S.td}>{used.toLocaleString()}</td>
                        <td style={S.td}>${used > 0 ? ((t.cost || 0) / used).toFixed(3) : '—'}</td>
                        <td style={{ ...S.td, color: t.status === 'failed' ? '#EF4444' : '#7C8BA0', textTransform: 'uppercase', fontSize: 10, fontWeight: 600 }}>{t.status}</td>
                        <td style={S.td}>{t.removal_reason || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ALL TIRES (inventory) */}
      {tab === 'inventory' && (
        <>
          <div style={S.sectionLabel}>All Active Tires</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Unit</th><th style={S.th}>Pos</th><th style={S.th}>Brand</th><th style={S.th}>Size</th>
              <th style={S.th}>Tread</th><th style={S.th}>Life</th><th style={S.th}>Remaining</th><th style={S.th}>CPM</th>
            </tr></thead>
            <tbody>
              {fleet.flatMap(a => (a.tires || []).map((t: any) => {
                const life = tireLife(t, a.odometer || 0)
                const tread = treadStatus(t)
                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => { setTab('fleet'); setSelectedAsset(a); loadAssetTires(user.shop_id, a.id) }}>
                    <td style={S.td}>#{a.unit_number}</td>
                    <td style={S.td}>{POSITIONS.find(p => p.key === t.position)?.short}</td>
                    <td style={S.td}>{t.brand} {t.is_recap ? '(R)' : ''}</td>
                    <td style={S.td}>{t.size}</td>
                    <td style={{ ...S.td, color: tread.color, fontWeight: 600 }}>{t.current_tread}/32"</td>
                    <td style={S.td}><span style={{ color: lifeColor(life.pct), fontWeight: 600 }}>{life.pct}%</span></td>
                    <td style={S.td}>{life.remaining.toLocaleString()} mi</td>
                    <td style={S.td}>${costPerMile(t, a.odometer || 0).toFixed(3)}</td>
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </>
      )}

      {/* COSTS */}
      {tab === 'costs' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={S.sectionLabel}>Cost Analysis</div>
            <button onClick={() => { setModal('price'); setF({}) }} style={S.btn}>+ Add Price</button>
          </div>

          {/* Brand CPM summary */}
          <div style={S.sectionLabel}>Cost per Mile by Brand</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, marginBottom: 24 }}>
            {(() => {
              const brands: Record<string, { totalCost: number; totalMiles: number; count: number }> = {}
              for (const a of fleet) {
                for (const t of a.tires || []) {
                  const b = t.brand || 'Unknown'
                  if (!brands[b]) brands[b] = { totalCost: 0, totalMiles: 0, count: 0 }
                  brands[b].totalCost += t.cost || 0
                  brands[b].totalMiles += Math.max(0, (a.odometer || 0) - (t.install_mileage || 0))
                  brands[b].count++
                }
              }
              return Object.entries(brands).sort((a, b) => {
                const cpmA = a[1].totalMiles > 0 ? a[1].totalCost / a[1].totalMiles : 999
                const cpmB = b[1].totalMiles > 0 ? b[1].totalCost / b[1].totalMiles : 999
                return cpmA - cpmB
              }).map(([brand, d]) => (
                <div key={brand} style={S.card}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF' }}>{brand}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#00E0B0', marginTop: 4 }}>
                    ${d.totalMiles > 0 ? (d.totalCost / d.totalMiles).toFixed(3) : '—'}
                    <span style={{ fontSize: 11, color: '#7C8BA0', fontWeight: 400 }}>/mi</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#7C8BA0', marginTop: 4 }}>{d.count} tires · ${d.totalCost.toLocaleString()} total</div>
                </div>
              ))
            })()}
          </div>

          {/* Vendor price history */}
          {prices.length > 0 && (
            <>
              <div style={S.sectionLabel}>Vendor Price History</div>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Vendor</th><th style={S.th}>Brand</th><th style={S.th}>Size</th><th style={S.th}>Recap</th><th style={S.th}>Price</th><th style={S.th}>Date</th>
                </tr></thead>
                <tbody>
                  {prices.map(p => (
                    <tr key={p.id}>
                      <td style={S.td}>{p.vendor}</td><td style={S.td}>{p.brand} {p.model || ''}</td>
                      <td style={S.td}>{p.size}</td><td style={S.td}>{p.is_recap ? 'Yes' : '—'}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>${p.price}</td>
                      <td style={S.td}>{new Date(p.quoted_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {/* ALERTS */}
      {tab === 'alerts' && (
        <>
          <div style={S.sectionLabel}>Active Alerts ({alerts.length})</div>
          {alerts.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#48536A' }}>No tire alerts</div>}
          {alerts.map((a, i) => (
            <div key={i} onClick={() => { const asset = fleet.find(f => f.id === a.assetId); if (asset) { setTab('fleet'); setSelectedAsset(asset); loadAssetTires(user.shop_id, asset.id) } }}
              style={{ ...S.card, borderLeftWidth: 3, borderLeftColor: a.color, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 20 }}>{a.type === 'tread' ? '⚠️' : a.type === 'expired' ? '🔴' : '🟡'}</div>
              <div>
                <div style={{ fontSize: 13, color: '#F0F4FF', fontWeight: 600 }}>{a.msg}</div>
                <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', marginTop: 2 }}>{a.type}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── MODALS ──────────────────────────────────────────── */}
      {modal && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>

            {/* INSTALL TIRE */}
            {modal === 'install' && <>
              <div style={S.modalTitle}>Install New Tire</div>
              <div style={S.fieldLabel}>Position</div>
              <select value={f.position || ''} onChange={e => upd('position', e.target.value)} style={S.input}>
                <option value="">Select...</option>
                {POSITIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <div><div style={S.fieldLabel}>Brand</div><input value={f.brand || ''} onChange={e => upd('brand', e.target.value)} style={S.input} placeholder="Michelin" /></div>
                <div><div style={S.fieldLabel}>Model</div><input value={f.model || ''} onChange={e => upd('model', e.target.value)} style={S.input} placeholder="XDN2" /></div>
                <div><div style={S.fieldLabel}>Size</div><input value={f.size || ''} onChange={e => upd('size', e.target.value)} style={S.input} placeholder="11R22.5" /></div>
                <div><div style={S.fieldLabel}>DOT Code</div><input value={f.dot_code || ''} onChange={e => upd('dot_code', e.target.value)} style={S.input} /></div>
                <div><div style={S.fieldLabel}>Cost ($)</div><input value={f.cost || ''} onChange={e => upd('cost', e.target.value)} type="number" style={S.input} /></div>
                <div><div style={S.fieldLabel}>Expected Life (mi)</div><input value={f.expected_life || '100000'} onChange={e => upd('expected_life', parseInt(e.target.value))} type="number" style={S.input} /></div>
                <div><div style={S.fieldLabel}>Install Mileage</div><input value={f.install_mileage || ''} onChange={e => upd('install_mileage', parseInt(e.target.value))} type="number" style={S.input} /></div>
                <div><div style={S.fieldLabel}>Tread Depth (32nds)</div><input value={f.current_tread || '12'} onChange={e => upd('current_tread', parseFloat(e.target.value))} type="number" step="0.5" style={S.input} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <label style={{ fontSize: 12, color: '#7C8BA0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={f.is_recap || false} onChange={e => upd('is_recap', e.target.checked)} /> Recap/Retread
                </label>
              </div>
              <div style={{ ...S.fieldLabel, marginTop: 12 }}>Vendor</div>
              <input value={f.vendor || ''} onChange={e => upd('vendor', e.target.value)} style={S.input} placeholder="Tire vendor" />
              <button onClick={installTire} disabled={saving || !f.position} style={{ ...S.bigBtn, marginTop: 16, opacity: saving || !f.position ? 0.5 : 1 }}>
                {saving ? 'Installing...' : 'Install Tire'}
              </button>
            </>}

            {/* LOG TREAD */}
            {modal === 'tread' && <>
              <div style={S.modalTitle}>Log Tread Depth</div>
              <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 12 }}>{modalTire?.brand} · {POSITIONS.find(p => p.key === modalTire?.position)?.label}</div>
              <div style={S.fieldLabel}>Tread Depth (32nds of inch)</div>
              <input value={f.tread_depth || ''} onChange={e => upd('tread_depth', e.target.value)} type="number" step="0.5" style={S.input} placeholder="e.g. 8.0" autoFocus />
              <div style={{ ...S.fieldLabel, marginTop: 12 }}>Current Mileage</div>
              <input value={f.mileage || ''} onChange={e => upd('mileage', e.target.value)} type="number" style={S.input} />
              <button onClick={logTread} disabled={saving || !f.tread_depth} style={{ ...S.bigBtn, marginTop: 16, opacity: saving || !f.tread_depth ? 0.5 : 1 }}>Save</button>
            </>}

            {/* LOG PRESSURE */}
            {modal === 'pressure' && <>
              <div style={S.modalTitle}>Log Tire Pressure</div>
              <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 12 }}>{modalTire?.brand} · {POSITIONS.find(p => p.key === modalTire?.position)?.label}</div>
              <div style={S.fieldLabel}>PSI Reading</div>
              <input value={f.psi || ''} onChange={e => upd('psi', e.target.value)} type="number" style={S.input} placeholder="e.g. 100" autoFocus />
              <div style={{ ...S.fieldLabel, marginTop: 12 }}>Target PSI</div>
              <input value={f.target_psi || '100'} onChange={e => upd('target_psi', e.target.value)} type="number" style={S.input} />
              <button onClick={logPressure} disabled={saving || !f.psi} style={{ ...S.bigBtn, marginTop: 16, opacity: saving || !f.psi ? 0.5 : 1 }}>Save</button>
            </>}

            {/* REMOVE TIRE */}
            {modal === 'remove' && <>
              <div style={S.modalTitle}>Remove Tire</div>
              <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 12 }}>{modalTire?.brand} {modalTire?.size} · {POSITIONS.find(p => p.key === modalTire?.position)?.label}</div>
              <div style={S.fieldLabel}>Reason</div>
              <select value={f.removal_reason || 'worn'} onChange={e => upd('removal_reason', e.target.value)} style={S.input}>
                <option value="worn">Worn Out</option>
                <option value="failure">Blowout / Failure</option>
                <option value="retread">Sending for Retread</option>
                <option value="damage">Road Damage</option>
                <option value="other">Other</option>
              </select>
              <div style={{ ...S.fieldLabel, marginTop: 12 }}>Mileage at Removal</div>
              <input value={f.removed_mileage || ''} onChange={e => upd('removed_mileage', e.target.value)} type="number" style={S.input} />
              <div style={{ ...S.fieldLabel, marginTop: 12 }}>Notes</div>
              <textarea value={f.failure_notes || ''} onChange={e => upd('failure_notes', e.target.value)} style={{ ...S.input, height: 60, resize: 'none' }} />
              <button onClick={removeTire} disabled={saving} style={{ ...S.bigBtn, marginTop: 16, background: '#EF4444', opacity: saving ? 0.5 : 1 }}>Remove Tire</button>
            </>}

            {/* ADD VENDOR PRICE */}
            {modal === 'price' && <>
              <div style={S.modalTitle}>Record Vendor Price</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={S.fieldLabel}>Vendor</div><input value={f.vendor || ''} onChange={e => upd('vendor', e.target.value)} style={S.input} /></div>
                <div><div style={S.fieldLabel}>Brand</div><input value={f.brand || ''} onChange={e => upd('brand', e.target.value)} style={S.input} /></div>
                <div><div style={S.fieldLabel}>Size</div><input value={f.size || ''} onChange={e => upd('size', e.target.value)} style={S.input} placeholder="11R22.5" /></div>
                <div><div style={S.fieldLabel}>Price ($)</div><input value={f.price || ''} onChange={e => upd('price', e.target.value)} type="number" style={S.input} /></div>
              </div>
              <button onClick={addPrice} disabled={saving || !f.vendor || !f.brand || !f.size || !f.price}
                style={{ ...S.bigBtn, marginTop: 16, opacity: saving || !f.vendor ? 0.5 : 1 }}>Save Price</button>
            </>}

          </div>
        </div>
      )}
    </div>
  )
}

// ── STYLES ─────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', letterSpacing: '.03em' },
  card: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 16, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: 600, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#7C8BA0', marginBottom: 4 },
  input: { width: '100%', padding: '10px 12px', background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 8, color: '#DDE3EE', fontSize: 13, fontFamily: "'Instrument Sans',sans-serif", outline: 'none', boxSizing: 'border-box' as const },
  btn: { padding: '10px 18px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#00E0B0,#00805F)', color: '#fff' },
  bigBtn: { padding: '14px 24px', borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#00E0B0,#00805F)', color: '#fff', width: '100%', textAlign: 'center' as const },
  smallBtn: { padding: '5px 10px', borderRadius: 6, border: '1px solid #1A1D23', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'none', color: '#7C8BA0' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#48536A', textTransform: 'uppercase' as const, letterSpacing: '.1em', padding: '8px 10px', textAlign: 'left' as const, background: '#0B0D11', whiteSpace: 'nowrap' as const },
  td: { padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 12, color: '#A0AABF' },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' as const },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#F0F4FF', marginBottom: 16 },
}
