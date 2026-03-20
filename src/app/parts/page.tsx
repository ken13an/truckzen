'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function PartsPage() {
  const supabase = createClient()
  const [user,  setUser]  = useState<any>(null)
  const [parts, setParts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)
      const { data } = await supabase
        .from('parts')
        .select('id, part_number, description, category, on_hand, reorder_point, cost_price, sell_price, vendor, bin_location, core_charge, warranty_months')
        .eq('shop_id', profile.shop_id)
        .order('description')
      setParts(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = parts.filter(p =>
    !search || p.description?.toLowerCase().includes(search.toLowerCase()) || p.part_number?.toLowerCase().includes(search.toLowerCase())
  )

  const margin = (p: any) => p.sell_price && p.cost_price ? Math.round((p.sell_price - p.cost_price) / p.sell_price * 100) : 0

  return (
    <div style={{ background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF' }}>Parts Inventory</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>{filtered.length} parts · {parts.filter(p => p.on_hand <= p.reorder_point).length} low stock</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ padding:'7px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#DDE3EE', fontSize:11, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={() => window.location.href = '/parts/new'} style={{ padding:'7px 14px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add Part</button>
        </div>
      </div>
      <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
            <thead>
              <tr>{['Part #','Description','Category','On Hand','Reorder At','Cost','Sell','Margin','Bin','Status'].map(h =>
                <th key={h} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 10px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'#7C8BA0' }}>Loading...</td></tr>
              : filtered.map(p => {
                const isLow = p.on_hand <= p.reorder_point
                const isOut = p.on_hand === 0
                const m = margin(p)
                return (
                  <tr key={p.id} style={{ borderBottom:'1px solid rgba(255,255,255,.025)', cursor:'pointer' }} onClick={() => window.location.href = '/parts/' + p.id}>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#4D9EFF' }}>{p.part_number}</td>
                    <td style={{ padding:'9px 10px', color:'#F0F4FF', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.description}</td>
                    <td style={{ padding:'9px 10px', fontSize:10, color:'#7C8BA0' }}>{p.category}</td>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, color: isOut?'#D94F4F':isLow?'#D4882A':'#DDE3EE', textAlign:'center' }}>{p.on_hand}</td>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#7C8BA0', textAlign:'center' }}>{p.reorder_point}</td>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#7C8BA0' }}>{'$'+(p.cost_price||0).toFixed(0)}</td>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#DDE3EE' }}>{'$'+(p.sell_price||0).toFixed(0)}</td>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700, color: m>=40?'#1DB870':m>=25?'#D4882A':'#D94F4F' }}>{m}%</td>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#48536A' }}>{p.bin_location}</td>
                    <td style={{ padding:'9px 10px' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background: isOut?'rgba(217,79,79,.1)':isLow?'rgba(212,136,42,.1)':'rgba(29,184,112,.1)', color: isOut?'#D94F4F':isLow?'#D4882A':'#1DB870', border:'1px solid currentColor' }}>
                        <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>
                        {isOut?'Out of Stock':isLow?'Low Stock':'In Stock'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}