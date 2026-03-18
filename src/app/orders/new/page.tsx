'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function NewSOPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [user,       setUser]       = useState<any>(null)
  const [assets,     setAssets]     = useState<any[]>([])
  const [customers,  setCustomers]  = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const [form, setForm] = useState({
    asset_id:    '',
    customer_id: '',
    complaint:   '',
    source:      'walk_in' as string,
    priority:    'normal'  as string,
    team:        ''        as string,
    bay:         ''        as string,
  })

  const [assetSearch, setAssetSearch] = useState('')
  const [filteredAssets, setFilteredAssets] = useState<any[]>([])
  const [selectedAsset, setSelectedAsset] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setUser(profile)

      const [{ data: a }, { data: c }] = await Promise.all([
        supabase.from('assets').select('id, unit_number, year, make, model, customer_id').eq('shop_id', profile.shop_id).eq('status', 'active').order('unit_number'),
        supabase.from('customers').select('id, company_name').eq('shop_id', profile.shop_id).order('company_name'),
      ])
      setAssets(a || [])
      setCustomers(c || [])
    }
    load()
  }, [])

  // Truck search
  useEffect(() => {
    if (!assetSearch) { setFilteredAssets([]); return }
    const q = assetSearch.toLowerCase()
    setFilteredAssets(assets.filter(a =>
      a.unit_number?.toLowerCase().includes(q) ||
      a.make?.toLowerCase().includes(q) ||
      a.model?.toLowerCase().includes(q)
    ).slice(0, 8))
  }, [assetSearch, assets])

  function selectAsset(asset: any) {
    setSelectedAsset(asset)
    setAssetSearch(`#${asset.unit_number} — ${asset.year} ${asset.make} ${asset.model}`)
    setFilteredAssets([])
    setForm(f => ({
      ...f,
      asset_id: asset.id,
      customer_id: asset.customer_id || '',
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset_id)  { setError('Select a truck'); return }
    if (!form.complaint) { setError('Describe the complaint'); return }

    setSubmitting(true)
    setError('')

    const res = await fetch('/api/service-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to create service order')
      setSubmitting(false)
      return
    }

    router.push(`/orders/${data.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page:   { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:680, margin:'0 auto' },
    title:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 },
    card:   { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:20, marginBottom:14 },
    label:  { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    input:  { width:'100%', padding:'10px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:13, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:42, boxSizing:'border-box' as const },
    select: { width:'100%', padding:'10px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:13, color:'#DDE3EE', outline:'none', fontFamily:'inherit', appearance:'none', cursor:'pointer', minHeight:42, boxSizing:'border-box' as const },
    row:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 },
    btn:    { padding:'13px 24px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:9, fontSize:14, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', minHeight:50 },
    error:  { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:'#D94F4F', marginBottom:14 },
  }

  return (
    <div style={S.page}>
      <a href="/orders" style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#7C8BA0', textDecoration:'none', marginBottom:20 }}>← Orders</a>
      <div style={S.title}>New Service Order</div>
      <div style={{ fontSize:12, color:'#7C8BA0', marginBottom:20 }}>All service orders are AI-assisted. You describe the complaint, AI writes the professional notes.</div>

      {error && <div style={S.error}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Truck lookup */}
        <div style={S.card}>
          <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:14 }}>Vehicle</div>
          <label style={S.label}>Search by unit number, make, or model</label>
          <div style={{ position:'relative' }}>
            <input style={S.input} value={assetSearch} onChange={e => { setAssetSearch(e.target.value); if (!e.target.value) { setSelectedAsset(null); setForm(f => ({...f, asset_id:'', customer_id:''})) } }}
              placeholder="e.g. 2717 or Kenworth or T680"/>
            {filteredAssets.length > 0 && (
              <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'#1C2130', border:'1px solid rgba(255,255,255,.12)', borderRadius:9, overflow:'hidden', zIndex:50, boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
                {filteredAssets.map(a => (
                  <div key={a.id} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12 }}
                    onClick={() => selectAsset(a)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,111,232,.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ fontFamily:'monospace', fontWeight:700, color:'#4D9EFF' }}>#{a.unit_number}</span>
                    <span style={{ color:'#DDE3EE', marginLeft:8 }}>{a.year} {a.make} {a.model}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedAsset && (
            <div style={{ marginTop:10, padding:'10px 12px', background:'rgba(29,111,232,.06)', border:'1px solid rgba(29,111,232,.15)', borderRadius:8 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF' }}>Unit #{selectedAsset.unit_number} — {selectedAsset.year} {selectedAsset.make} {selectedAsset.model}</div>
            </div>
          )}
        </div>

        {/* Complaint */}
        <div style={S.card}>
          <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:14 }}>Complaint</div>
          <label style={S.label}>Describe what the customer reported</label>
          <textarea style={{ ...S.input, minHeight:100, resize:'vertical' as const }}
            value={form.complaint} onChange={e => setForm(f => ({...f, complaint: e.target.value}))}
            placeholder="e.g. Oil leak from rear of engine. Getting worse over last 2 weeks. Check engine light on."/>
          <div style={{ fontSize:11, color:'#48536A', marginTop:6 }}>AI will generate professional cause and correction notes after the SO is created.</div>
        </div>

        {/* Details */}
        <div style={S.card}>
          <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:14 }}>Details</div>
          <div style={S.row}>
            <div>
              <label style={S.label}>Source</label>
              <select style={S.select} value={form.source} onChange={e => setForm(f => ({...f, source: e.target.value}))}>
                <option value="walk_in">Walk In</option>
                <option value="phone">Phone</option>
                <option value="kiosk">Kiosk</option>
                <option value="portal">Customer Portal</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Priority</label>
              <select style={S.select} value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical — Truck Down</option>
              </select>
            </div>
          </div>
          <div style={S.row}>
            <div>
              <label style={S.label}>Team</label>
              <select style={S.select} value={form.team} onChange={e => setForm(f => ({...f, team: e.target.value}))}>
                <option value="">Unassigned</option>
                <option value="A">Team A — Engine & Diagnostics</option>
                <option value="B">Team B — Electrical</option>
                <option value="C">Team C — Body & Chassis</option>
                <option value="D">Team D — Inspection</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Bay</label>
              <select style={S.select} value={form.bay} onChange={e => setForm(f => ({...f, bay: e.target.value}))}>
                <option value="">No Bay</option>
                {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={`Bay ${i+1}`}>Bay {i+1}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={S.label}>Customer (auto-filled from truck)</label>
            <select style={S.select} value={form.customer_id} onChange={e => setForm(f => ({...f, customer_id: e.target.value}))}>
              <option value="">No customer linked</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" style={{ ...S.btn, width:'100%' }} disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Service Order →'}
        </button>
      </form>
    </div>
  )
}
