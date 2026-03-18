'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function CustomersPage() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      const res  = await fetch('/api/customers')
      const data = await res.json()
      setCustomers(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = customers.filter(c =>
    !search || c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 12px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' },
    td:    { padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:12 },
  }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={S.title}>Customers</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>{filtered.length} companies</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone..."
            style={{ padding:'7px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#DDE3EE', fontSize:11, fontFamily:'inherit', outline:'none', width:200 }}/>
          <button onClick={() => window.location.href='/customers/new'}
            style={{ padding:'7px 14px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            + Add Customer
          </button>
        </div>
      </div>

      <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:560 }}>
            <thead><tr>{['Company','Contact','Phone','Email','Payment Terms','Vehicles'].map(h =>
              <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#7C8BA0', padding:40 }}>Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#7C8BA0', padding:40 }}>No customers yet</td></tr>
              : filtered.map(c => (
                <tr key={c.id} style={{ cursor:'pointer' }} onClick={() => window.location.href = `/customers/${c.id}`}>
                  <td style={{ ...S.td, fontWeight:700, color:'#F0F4FF' }}>{c.company_name}</td>
                  <td style={{ ...S.td, color:'#DDE3EE' }}>{c.contact_name || '—'}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontSize:11, color:'#7C8BA0' }}>{c.phone || '—'}</td>
                  <td style={{ ...S.td, fontSize:11, color:'#7C8BA0' }}>{c.email || '—'}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:'#48536A' }}>{c.payment_terms || 'Net 30'}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontSize:11, color:'#4D9EFF' }}>
                    {c.assets?.length || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
