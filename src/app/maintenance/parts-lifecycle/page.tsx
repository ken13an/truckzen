'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

type Tab = 'fleet' | 'forecast' | 'costs' | 'configs'
type Modal = null | 'install' | 'replace' | 'price' | 'config'

function lifeColor(pct: number) { return pct > 20 ? '#22C55E' : pct > 10 ? '#F59E0B' : '#EF4444' }
function lifeBg(pct: number) { return pct > 20 ? 'rgba(34,197,94,.06)' : pct > 10 ? 'rgba(245,158,11,.06)' : 'rgba(239,68,68,.06)' }

export default function PartsLifecyclePage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('fleet')
  const [fleet, setFleet] = useState<any[]>([])
  const [configs, setConfigs] = useState<any[]>([])
  const [forecast, setForecast] = useState<any[]>([])
  const [prices, setPrices] = useState<any[]>([])
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [assetHistory, setAssetHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>(null)
  const [modalItem, setModalItem] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all')
  const [forecastDays, setForecastDays] = useState(90)
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState<any>({})
  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))
  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const api = useCallback(async (params: string) => {
    const res = await fetch(`/api/parts-lifecycle?shop_id=${user?.shop_id}&${params}`)
    return res.json()
  }, [user])

  const post = useCallback(async (body: any) => {
    setSaving(true)
    const res = await fetch('/api/parts-lifecycle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, shop_id: user?.shop_id }) })
    setSaving(false)
    return res.json()
  }, [user])

  const loadFleet = useCallback(async () => { if (!user) return; setFleet(await api('view=fleet')) }, [user, api])
  const loadConfigs = useCallback(async () => { if (!user) return; setConfigs(await api('view=configs')) }, [user, api])
  const loadForecast = useCallback(async () => { if (!user) return; setForecast(await api(`view=forecast&days=${forecastDays}`)) }, [user, api, forecastDays])
  const loadPrices = useCallback(async () => { if (!user) return; setPrices(await api('view=prices')) }, [user, api])
  const loadAssetDetail = useCallback(async (assetId: string) => { if (!user) return; setAssetHistory(await api(`asset_id=${assetId}`)) }, [user, api])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    loadFleet(); loadConfigs()
    setLoading(false)
  }, [user])

  useEffect(() => { if (tab === 'forecast') loadForecast() }, [tab, forecastDays, user])
  useEffect(() => { if (tab === 'costs') loadPrices() }, [tab, user])

  // Install part
  async function installPart() {
    if (!f.asset_id || !f.part_type) return
    await post({ action: 'install', ...f })
    flash('Part installed')
    setModal(null); setF({})
    if (selectedAsset) loadAssetDetail(selectedAsset.id)
    loadFleet()
  }

  async function replacePart() {
    if (!modalItem) return
    await post({ action: 'replace', install_id: modalItem.id, reason: f.reason || 'replaced', mileage: parseInt(f.mileage) || null })
    flash('Part marked replaced')
    setModal(null); setF({})
    if (selectedAsset) loadAssetDetail(selectedAsset.id)
    loadFleet()
  }

  async function saveConfig() {
    if (!f.part_type || !f.display_name) return
    await post({ action: 'save_config', ...f })
    flash('Config saved')
    setModal(null); setF({})
    loadConfigs()
  }

  async function addPrice() {
    if (!f.vendor || !f.part_type || !f.price) return
    await post({ action: 'add_price', ...f })
    flash('Price recorded')
    setModal(null); setF({})
    loadPrices()
  }

  // Helpers
  const cfgMap = new Map(configs.map((c: any) => [c.part_type, c]))
  function cfgName(type: string) { return cfgMap.get(type)?.display_name || type.replace(/_/g, ' ') }
  function cfgIcon(type: string) { return cfgMap.get(type)?.icon || '🔧' }

  const filtered = fleet.filter((a: any) => {
    if (search && !a.unit_number?.toLowerCase().includes(search.toLowerCase()) && !(a.customers as any)?.company_name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus === 'green') return a.worst_life_pct > 20
    if (filterStatus === 'yellow') return a.worst_life_pct > 10 && a.worst_life_pct <= 20
    if (filterStatus === 'red') return a.worst_life_pct <= 10
    return true
  })

  if (loading) return <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0' }}>Loading...</div>

  return (
    <div style={S.page}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#00E0B0', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={S.title}>Parts Lifecycle</div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>
            {fleet.length} units · {fleet.reduce((s: number, a: any) => s + (a.part_count || 0), 0)} tracked parts · {configs.length} part types
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0D0F12', borderRadius: 10, padding: 4 }}>
        {([['fleet', 'Fleet'], ['forecast', 'Forecast'], ['costs', 'Costs'], ['configs', 'Part Types']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setSelectedAsset(null) }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === k ? '#1A1D23' : 'transparent', color: tab === k ? '#F0F4FF' : '#48536A' }}>{l}</button>
        ))}
      </div>

      {/* FLEET VIEW */}
      {tab === 'fleet' && !selectedAsset && <>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit # or customer..." style={{ ...S.input, flex: 1, minWidth: 180 }} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...S.input, width: 160 }}>
            <option value="">All part types</option>
            {configs.map((c: any) => <option key={c.part_type} value={c.part_type}>{c.icon} {c.display_name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={{ ...S.input, width: 120 }}>
            <option value="all">All</option><option value="green">Healthy</option><option value="yellow">Warning</option><option value="red">Critical</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {filtered.map((a: any) => (
            <div key={a.id} onClick={() => { setSelectedAsset(a); loadAssetDetail(a.id) }}
              style={{ ...S.card, cursor: 'pointer', borderColor: `${lifeColor(a.worst_life_pct)}20` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF' }}>#{a.unit_number}</div>
                  <div style={{ fontSize: 11, color: '#7C8BA0' }}>{a.year} {a.make} {a.model}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: lifeColor(a.worst_life_pct) }}>{a.worst_life_pct}%</div>
                  <div style={{ fontSize: 9, color: '#48536A', textTransform: 'uppercase' }}>Worst part</div>
                </div>
              </div>
              {/* Part chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(a.parts || []).slice(0, 8).map((p: any) => (
                  <span key={p.id} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: lifeBg(p.life_pct), color: lifeColor(p.life_pct), fontWeight: 600 }}>
                    {cfgIcon(p.part_type)} {p.life_pct}%
                  </span>
                ))}
                {(a.parts || []).length > 8 && <span style={{ fontSize: 10, color: '#48536A' }}>+{a.parts.length - 8}</span>}
              </div>
              <div style={{ marginTop: 8, height: 3, background: '#1A1D23', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${a.worst_life_pct}%`, height: '100%', background: lifeColor(a.worst_life_pct), borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#48536A', marginTop: 6 }}>
                <span>{a.part_count} parts tracked</span>
                <span>{(a.odometer || 0).toLocaleString()} mi</span>
                <span>${(a.total_parts_cost || 0).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* ASSET DETAIL */}
      {tab === 'fleet' && selectedAsset && <>
        <button onClick={() => setSelectedAsset(null)} style={{ background: 'none', border: 'none', color: '#00E0B0', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 16 }}>← Back</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF' }}>#{selectedAsset.unit_number}</div>
            <div style={{ fontSize: 13, color: '#7C8BA0' }}>{selectedAsset.year} {selectedAsset.make} {selectedAsset.model} · {(selectedAsset.odometer || 0).toLocaleString()} mi</div>
          </div>
          <button onClick={() => { setModal('install'); setF({ asset_id: selectedAsset.id, install_mileage: selectedAsset.odometer || 0 }) }} style={S.btn}>+ Install Part</button>
        </div>

        {/* Active parts grid */}
        <div style={S.sectionLabel}>Active Parts</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 24 }}>
          {assetHistory.filter((p: any) => p.status === 'active').map((p: any) => {
            const cfg = cfgMap.get(p.part_type)
            const lifeMi = p.expected_life_mi || cfg?.default_life_mi
            const lifeDays = p.expected_life_days || cfg?.default_life_days
            let pctMi = 100, pctDays = 100, remainMi = null as number | null, remainDays = null as number | null
            if (lifeMi) { const used = (selectedAsset.odometer || 0) - (p.install_mileage || 0); pctMi = Math.max(0, Math.round((1 - used / lifeMi) * 100)); remainMi = Math.max(0, lifeMi - used) }
            if (lifeDays) { const daysSince = Math.floor((Date.now() - new Date(p.install_date).getTime()) / 86400000); pctDays = Math.max(0, Math.round((1 - daysSince / lifeDays) * 100)); remainDays = Math.max(0, lifeDays - daysSince) }
            const pct = Math.min(pctMi, pctDays)

            return (
              <div key={p.id} style={{ ...S.card, background: lifeBg(pct), borderColor: `${lifeColor(pct)}20` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{cfgIcon(p.part_type)}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: lifeColor(pct) }}>{pct}%</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{cfgName(p.part_type)}</div>
                <div style={{ fontSize: 11, color: '#7C8BA0', marginTop: 2 }}>{p.brand || '—'} {p.part_number || ''}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6, fontSize: 10, color: '#7C8BA0' }}>
                  {remainMi !== null && <div>Mi left: <span style={{ fontWeight: 600 }}>{remainMi.toLocaleString()}</span></div>}
                  {remainDays !== null && <div>Days left: <span style={{ fontWeight: 600 }}>{remainDays}</span></div>}
                  <div>Cost: <span style={{ fontWeight: 600 }}>${p.cost || 0}</span></div>
                  <div>Installed: {new Date(p.install_date).toLocaleDateString()}</div>
                </div>
                <div style={{ marginTop: 6, height: 3, background: '#1A1D23', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: lifeColor(pct), borderRadius: 2 }} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => { setModalItem(p); setModal('replace'); setF({ mileage: selectedAsset.odometer }) }} style={S.smallBtn}>Replace</button>
                  <button onClick={async () => { await post({ action: 'fail', install_id: p.id, mileage: selectedAsset.odometer }); flash('Marked failed'); loadAssetDetail(selectedAsset.id); loadFleet() }}
                    style={{ ...S.smallBtn, color: '#EF4444', borderColor: '#EF4444' }}>Failed</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* History table */}
        {assetHistory.filter((p: any) => p.status !== 'active').length > 0 && <>
          <div style={S.sectionLabel}>Replacement History</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Part</th><th style={S.th}>Brand</th><th style={S.th}>Installed</th><th style={S.th}>Replaced</th><th style={S.th}>Miles Used</th><th style={S.th}>CPM</th><th style={S.th}>Status</th>
            </tr></thead>
            <tbody>
              {assetHistory.filter((p: any) => p.status !== 'active').map((p: any) => {
                const used = (p.replaced_mileage || 0) - (p.install_mileage || 0)
                return (
                  <tr key={p.id}>
                    <td style={S.td}>{cfgIcon(p.part_type)} {cfgName(p.part_type)}</td>
                    <td style={S.td}>{p.brand || '—'}</td>
                    <td style={S.td}>{new Date(p.install_date).toLocaleDateString()}</td>
                    <td style={S.td}>{p.replaced_date ? new Date(p.replaced_date).toLocaleDateString() : '—'}</td>
                    <td style={S.td}>{used > 0 ? used.toLocaleString() : '—'}</td>
                    <td style={S.td}>{used > 0 ? `$${((p.cost || 0) / used).toFixed(3)}` : '—'}</td>
                    <td style={{ ...S.td, color: p.status === 'failed' ? '#EF4444' : '#7C8BA0', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{p.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>}
      </>}

      {/* FORECAST */}
      {tab === 'forecast' && <>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={S.sectionLabel}>Upcoming Replacements</div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {[30, 60, 90].map(d => (
              <button key={d} onClick={() => setForecastDays(d)}
                style={{ padding: '6px 14px', borderRadius: 6, border: forecastDays === d ? '1px solid #00E0B0' : '1px solid #1A1D23', background: forecastDays === d ? 'rgba(0,224,176,.1)' : 'transparent', color: forecastDays === d ? '#00E0B0' : '#48536A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        {forecast.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#48536A' }}>No replacements due in next {forecastDays} days</div>}
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Due In</th><th style={S.th}>Unit</th><th style={S.th}>Part</th><th style={S.th}>Brand</th><th style={S.th}>Mi Remaining</th><th style={S.th}>Installed</th>
          </tr></thead>
          <tbody>
            {forecast.map((p: any) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => { const a = fleet.find((x: any) => x.id === p.asset_id); if (a) { setTab('fleet'); setSelectedAsset(a); loadAssetDetail(a.id) } }}>
                <td style={{ ...S.td, color: p.days_until <= 7 ? '#EF4444' : p.days_until <= 30 ? '#F59E0B' : '#7C8BA0', fontWeight: 700 }}>
                  {p.days_until <= 0 ? 'OVERDUE' : `${p.days_until}d`}
                </td>
                <td style={S.td}>#{(p.assets as any)?.unit_number}</td>
                <td style={S.td}>{cfgIcon(p.part_type)} {p.config?.display_name || p.part_type}</td>
                <td style={S.td}>{p.brand || '—'}</td>
                <td style={S.td}>{p.miles_remaining != null ? p.miles_remaining.toLocaleString() : '—'}</td>
                <td style={S.td}>{new Date(p.install_date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>}

      {/* COSTS */}
      {tab === 'costs' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={S.sectionLabel}>Cost per Mile by Part Type & Brand</div>
          <button onClick={() => { setModal('price'); setF({}) }} style={S.btn}>+ Add Price</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 24 }}>
          {(() => {
            const brands: Record<string, { cost: number; miles: number; count: number }> = {}
            for (const a of fleet) {
              for (const p of (a as any).parts || []) {
                const k = `${cfgIcon(p.part_type)} ${cfgName(p.part_type)}|${p.brand || 'Unknown'}`
                if (!brands[k]) brands[k] = { cost: 0, miles: 0, count: 0 }
                brands[k].cost += p.cost || 0
                brands[k].miles += Math.max(0, (a.odometer || 0) - (p.install_mileage || 0))
                brands[k].count++
              }
            }
            return Object.entries(brands).sort((a, b) => {
              const ca = a[1].miles > 0 ? a[1].cost / a[1].miles : 999
              const cb = b[1].miles > 0 ? b[1].cost / b[1].miles : 999
              return ca - cb
            }).slice(0, 20).map(([key, d]) => {
              const [type, brand] = key.split('|')
              return (
                <div key={key} style={S.card}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{type}</div>
                  <div style={{ fontSize: 11, color: '#7C8BA0' }}>{brand}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#00E0B0', marginTop: 4 }}>
                    ${d.miles > 0 ? (d.cost / d.miles).toFixed(3) : '—'}<span style={{ fontSize: 11, color: '#7C8BA0', fontWeight: 400 }}>/mi</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#48536A', marginTop: 2 }}>{d.count} installs · ${d.cost.toLocaleString()} total</div>
                </div>
              )
            })
          })()}
        </div>
        {prices.length > 0 && <>
          <div style={S.sectionLabel}>Vendor Price History</div>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Part Type</th><th style={S.th}>Brand</th><th style={S.th}>Vendor</th><th style={S.th}>Price</th><th style={S.th}>Date</th></tr></thead>
            <tbody>{prices.map((p: any) => (
              <tr key={p.id}><td style={S.td}>{cfgName(p.part_type)}</td><td style={S.td}>{p.brand}</td><td style={S.td}>{p.vendor}</td><td style={{ ...S.td, fontWeight: 600 }}>${p.price}</td><td style={S.td}>{new Date(p.quoted_at).toLocaleDateString()}</td></tr>
            ))}</tbody>
          </table>
        </>}
      </>}

      {/* CONFIGS */}
      {tab === 'configs' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={S.sectionLabel}>Part Type Configurations</div>
          <button onClick={() => { setModal('config'); setF({}) }} style={S.btn}>+ Add Part Type</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
          {configs.map((c: any) => (
            <div key={c.id} onClick={() => { setModal('config'); setF({ ...c }) }}
              style={{ ...S.card, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{c.icon}</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF' }}>{c.display_name}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: '#7C8BA0' }}>
                {c.default_life_mi && <div>Life: {c.default_life_mi.toLocaleString()} mi</div>}
                {c.default_life_days && <div>Life: {c.default_life_days} days</div>}
                {c.preferred_vendor && <div>Vendor: {c.preferred_vendor}</div>}
                {c.preferred_brand && <div>Brand: {c.preferred_brand}</div>}
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* ── MODALS ──────────────────────────────────────────── */}
      {modal && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            {modal === 'install' && <>
              <div style={S.modalTitle}>Install Part</div>
              <div style={S.fl}>Part Type</div>
              <select value={f.part_type || ''} onChange={e => { upd('part_type', e.target.value); const c = cfgMap.get(e.target.value); if (c) { upd('expected_life_mi', c.default_life_mi); upd('expected_life_days', c.default_life_days) } }} style={S.input}>
                <option value="">Select...</option>
                {configs.map((c: any) => <option key={c.part_type} value={c.part_type}>{c.icon} {c.display_name}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <div><div style={S.fl}>Brand</div><input value={f.brand || ''} onChange={e => upd('brand', e.target.value)} style={S.input} /></div>
                <div><div style={S.fl}>Part Number</div><input value={f.part_number || ''} onChange={e => upd('part_number', e.target.value)} style={S.input} /></div>
                <div><div style={S.fl}>Cost ($)</div><input value={f.cost || ''} onChange={e => upd('cost', parseFloat(e.target.value))} type="number" style={S.input} /></div>
                <div><div style={S.fl}>Vendor</div><input value={f.vendor || ''} onChange={e => upd('vendor', e.target.value)} style={S.input} /></div>
                <div><div style={S.fl}>Expected Life (mi)</div><input value={f.expected_life_mi || ''} onChange={e => upd('expected_life_mi', parseInt(e.target.value))} type="number" style={S.input} /></div>
                <div><div style={S.fl}>Expected Life (days)</div><input value={f.expected_life_days || ''} onChange={e => upd('expected_life_days', parseInt(e.target.value))} type="number" style={S.input} /></div>
                <div><div style={S.fl}>Install Mileage</div><input value={f.install_mileage || ''} onChange={e => upd('install_mileage', parseInt(e.target.value))} type="number" style={S.input} /></div>
                <div><div style={S.fl}>Install Date</div><input value={f.install_date || new Date().toISOString().split('T')[0]} onChange={e => upd('install_date', e.target.value)} type="date" style={S.input} /></div>
              </div>
              <div style={{ ...S.fl, marginTop: 12 }}>Notes</div>
              <input value={f.notes || ''} onChange={e => upd('notes', e.target.value)} style={S.input} />
              <button onClick={installPart} disabled={saving || !f.part_type} style={{ ...S.bigBtn, marginTop: 16, opacity: saving || !f.part_type ? 0.5 : 1 }}>Install Part</button>
            </>}

            {modal === 'replace' && <>
              <div style={S.modalTitle}>Replace Part</div>
              <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 12 }}>{cfgIcon(modalItem?.part_type)} {cfgName(modalItem?.part_type)} — {modalItem?.brand}</div>
              <div style={S.fl}>Mileage at Replacement</div>
              <input value={f.mileage || ''} onChange={e => upd('mileage', e.target.value)} type="number" style={S.input} />
              <div style={{ ...S.fl, marginTop: 12 }}>Reason</div>
              <select value={f.reason || 'scheduled'} onChange={e => upd('reason', e.target.value)} style={S.input}>
                <option value="scheduled">Scheduled Replacement</option><option value="worn">Worn Out</option><option value="failure">Failure</option><option value="upgrade">Upgrade</option>
              </select>
              <button onClick={replacePart} disabled={saving} style={{ ...S.bigBtn, marginTop: 16, opacity: saving ? 0.5 : 1 }}>Mark Replaced</button>
            </>}

            {modal === 'config' && <>
              <div style={S.modalTitle}>{f.id ? 'Edit' : 'New'} Part Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={S.fl}>Type Key</div><input value={f.part_type || ''} onChange={e => upd('part_type', e.target.value)} style={S.input} placeholder="engine_oil" disabled={!!f.id} /></div>
                <div><div style={S.fl}>Display Name</div><input value={f.display_name || ''} onChange={e => upd('display_name', e.target.value)} style={S.input} placeholder="Engine Oil" /></div>
                <div><div style={S.fl}>Icon</div><input value={f.icon || ''} onChange={e => upd('icon', e.target.value)} style={S.input} placeholder="🛢️" /></div>
                <div><div style={S.fl}>Category</div><input value={f.category || ''} onChange={e => upd('category', e.target.value)} style={S.input} placeholder="filters_fluids" /></div>
                <div><div style={S.fl}>Default Life (mi)</div><input value={f.default_life_mi || ''} onChange={e => upd('default_life_mi', parseInt(e.target.value) || null)} type="number" style={S.input} /></div>
                <div><div style={S.fl}>Default Life (days)</div><input value={f.default_life_days || ''} onChange={e => upd('default_life_days', parseInt(e.target.value) || null)} type="number" style={S.input} /></div>
                <div><div style={S.fl}>Preferred Vendor</div><input value={f.preferred_vendor || ''} onChange={e => upd('preferred_vendor', e.target.value)} style={S.input} /></div>
                <div><div style={S.fl}>Preferred Brand</div><input value={f.preferred_brand || ''} onChange={e => upd('preferred_brand', e.target.value)} style={S.input} /></div>
              </div>
              <button onClick={saveConfig} disabled={saving || !f.part_type || !f.display_name} style={{ ...S.bigBtn, marginTop: 16, opacity: saving || !f.part_type ? 0.5 : 1 }}>Save</button>
            </>}

            {modal === 'price' && <>
              <div style={S.modalTitle}>Record Vendor Price</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={S.fl}>Part Type</div>
                  <select value={f.part_type || ''} onChange={e => upd('part_type', e.target.value)} style={S.input}>
                    <option value="">Select...</option>
                    {configs.map((c: any) => <option key={c.part_type} value={c.part_type}>{c.display_name}</option>)}
                  </select>
                </div>
                <div><div style={S.fl}>Brand</div><input value={f.brand || ''} onChange={e => upd('brand', e.target.value)} style={S.input} /></div>
                <div><div style={S.fl}>Vendor</div><input value={f.vendor || ''} onChange={e => upd('vendor', e.target.value)} style={S.input} /></div>
                <div><div style={S.fl}>Price ($)</div><input value={f.price || ''} onChange={e => upd('price', e.target.value)} type="number" style={S.input} /></div>
              </div>
              <button onClick={addPrice} disabled={saving || !f.vendor || !f.part_type || !f.price} style={{ ...S.bigBtn, marginTop: 16, opacity: saving || !f.vendor ? 0.5 : 1 }}>Save Price</button>
            </>}
          </div>
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', letterSpacing: '.03em' },
  card: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 16, marginBottom: 0 },
  sectionLabel: { fontSize: 11, fontWeight: 600, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 },
  fl: { fontSize: 11, fontWeight: 600, color: '#7C8BA0', marginBottom: 4 },
  input: { width: '100%', padding: '10px 12px', background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 8, color: '#DDE3EE', fontSize: 13, fontFamily: "'Instrument Sans',sans-serif", outline: 'none', boxSizing: 'border-box' as const },
  btn: { padding: '10px 18px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#00E0B0,#00805F)', color: '#fff' },
  bigBtn: { padding: '14px 24px', borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#00E0B0,#00805F)', color: '#fff', width: '100%', textAlign: 'center' as const },
  smallBtn: { padding: '5px 10px', borderRadius: 6, border: '1px solid #1A1D23', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'none', color: '#7C8BA0' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#48536A', textTransform: 'uppercase' as const, letterSpacing: '.1em', padding: '8px 10px', textAlign: 'left' as const, background: '#0B0D11', whiteSpace: 'nowrap' as const },
  td: { padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 12, color: '#A0AABF' },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' as const },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#F0F4FF', marginBottom: 16 },
}
