'use client'
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function PartsReorderPage() {
  const supabase = createClient()
  const [user,    setUser]    = useState<any>(null)
  const [parts,   setParts]   = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [selected,setSelected]= useState<Set<string>>(new Set())
  const [creating,setCreating]= useState(false)
  const [done,    setDone]    = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)
      const [{ data: p }, { data: v }] = await Promise.all([
        supabase.from('parts').select('id, part_number, description, category, on_hand, reorder_point, cost_price, vendor, bin_location').eq('shop_id', profile.shop_id).order('description'),
        supabase.from('vendors').select('id, name').eq('shop_id', profile.shop_id).eq('active', true).order('name'),
      ])
      // Only low stock parts
      setParts((p || []).filter((pt: any) => pt.on_hand <= pt.reorder_point))
      setVendors(v || [])
      setLoading(false)
    }
    load()
  }, [])

  function toggleAll() {
    if (selected.size === parts.length) setSelected(new Set())
    else setSelected(new Set(parts.map(p => p.id)))
  }

  async function createPO() {
    if (!selected.size) return
    setCreating(true)
    const lines = parts.filter(p => selected.has(p.id)).map(p => ({
      part_id:     p.id,
      part_number: p.part_number,
      description: p.description,
      quantity:    Math.max(1, p.reorder_point - p.on_hand + p.reorder_point),
      unit_cost:   p.cost_price || 0,
    }))
    const res  = await fetch('/api/purchase-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_name: 'Various', lines }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) setDone(data)
  }

  const selectedParts  = parts.filter(p => selected.has(p.id))
  const totalCost      = selectedParts.reduce((s, p) => s + (p.cost_price || 0) * Math.max(1, p.reorder_point - p.on_hand + p.reorder_point), 0)

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 },
    card:  { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden', marginBottom:14 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 12px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' },
    td:    { padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:12 },
  }

  if (done) return (
    <div style={{ ...S.page, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', maxWidth:400 }}>
        <div style={{ fontSize:16, fontWeight:700, color:'#1DB870', marginBottom:16 }}>Success</div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:8 }}>PO Created</div>
        <div style={{ fontSize:13, color:'#7C8BA0', marginBottom:4 }}>Purchase Order <strong style={{ color:'#4D9EFF' }}>{done.po_number}</strong></div>
        <div style={{ fontSize:13, color:'#7C8BA0', marginBottom:24 }}>{selectedParts.length} parts · ${totalCost.toFixed(0)} estimated cost</div>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          <button onClick={() => { setDone(null); setSelected(new Set()) }} style={{ padding:'10px 20px', background:'transparent', border:'1px solid rgba(255,255,255,.1)', borderRadius:9, color:'#7C8BA0', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Back to Reorder</button>
          <a href="/parts" style={{ padding:'10px 20px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', borderRadius:9, color:'#fff', fontSize:12, fontWeight:700, textDecoration:'none' }}>View Parts</a>
        </div>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <a href="/parts" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#EDEDF0', textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Parts
</a>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={S.title}>Reorder Parts</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>{parts.length} parts below reorder point</div>
        </div>
        {selected.size > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:12, color:'#7C8BA0' }}>{selected.size} selected</div>
              <div style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:'#4D9EFF' }}>~${totalCost.toFixed(0)} cost</div>
            </div>
            <button onClick={createPO} disabled={creating}
              style={{ padding:'10px 20px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:9, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {creating ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        )}
      </div>

      {loading ? <div style={{ color:'#7C8BA0', padding:40, textAlign:'center' }}>Loading...</div>
      : parts.length === 0 ? (
        <div style={{ ...S.card, padding:60, textAlign:'center' }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#1DB870', marginBottom:16 }}>All Good</div>
          <div style={{ fontSize:16, fontWeight:700, color:'#F0F4FF', marginBottom:6 }}>All parts are stocked</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>No parts are currently below their reorder point.</div>
        </div>
      ) : (
        <div style={S.card}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:560 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th as any, width:40 }}>
                    <input type="checkbox" checked={selected.size===parts.length} onChange={toggleAll} style={{ cursor:'pointer' }}/>
                  </th>
                  {['Part #','Description','On Hand','Reorder At','Order Qty','Unit Cost','Total','Vendor'].map(h => <th key={h} style={S.th as any}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parts.map(p => {
                  const orderQty  = Math.max(1, p.reorder_point - p.on_hand + p.reorder_point)
                  const lineCost  = (p.cost_price || 0) * orderQty
                  const isOut     = p.on_hand === 0
                  return (
                    <tr key={p.id} style={{ cursor:'pointer', background: selected.has(p.id)?'rgba(29,111,232,.04)':'' }}
                      onClick={() => setSelected(s => { const n = new Set(s); n.has(p.id)?n.delete(p.id):n.add(p.id); return n })}>
                      <td style={{ ...S.td, textAlign:'center' }}>
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => {}} style={{ cursor:'pointer' }}/>
                      </td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:'#4D9EFF' }}>{p.part_number || '—'}</td>
                      <td style={{ ...S.td, color:'#F0F4FF', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.description}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color: isOut?'#D94F4F':'#D4882A', textAlign:'center' }}>{p.on_hand}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', color:'#7C8BA0', textAlign:'center' }}>{p.reorder_point}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'#4D9EFF', textAlign:'center' }}>{orderQty}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', color:'#7C8BA0' }}>${(p.cost_price||0).toFixed(2)}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'#DDE3EE' }}>${lineCost.toFixed(2)}</td>
                      <td style={{ ...S.td, fontSize:11, color:'#48536A' }}>{p.vendor || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
