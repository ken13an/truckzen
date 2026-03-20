'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const ROLE_COLOR: Record<string, string> = {
  owner:'#D4882A', gm:'#D4882A', it_person:'#8B5CF6',
  shop_manager:'#4D9EFF', service_writer:'#4D9EFF',
  technician:'#1DB870', maintenance_technician:'#1DB870',
  parts_manager:'#E8692A', fleet_manager:'#0E9F8E',
  accountant:'#DDE3EE', office_admin:'#DDE3EE', dispatcher:'#DDE3EE',
  driver:'#7C8BA0', customer:'#7C8BA0',
}

export default function UsersPage() {
  const supabase = createClient()
  const [users,   setUsers]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [saving,  setSaving]  = useState(false)

  async function load() {
    const profile = await getCurrentUser(supabase)
    if (!profile) { window.location.href='/login'; return }
    if (!['owner','gm','it_person','shop_manager','office_admin'].includes(profile.role)) { window.location.href='/dashboard'; return }
    const res  = await fetch('/api/users')
    const data = await res.json()
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveUser() {
    setSaving(true)
    await fetch(`/api/users/${editing.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ role:editing.role, team:editing.team, telegram_id:editing.telegram_id, active:editing.active }) })
    setEditing(null); setSaving(false); load()
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this user? They will no longer be able to log in.')) return
    await fetch(`/api/users/${id}`, { method:'DELETE' }); load()
  }

  const filtered = users.filter(u => !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))

  const S: Record<string, React.CSSProperties> = {
    page:   { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 },
    card:   { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden', marginBottom:12 },
    th:     { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 10px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' },
    td:     { padding:'10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:11 },
    btn:    { padding:'5px 10px', borderRadius:6, border:'none', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
    label:  { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    input:  { width:'100%', padding:'8px 11px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:7, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:36, boxSizing:'border-box' as const },
    overlay:{ position:'fixed' as const, inset:0, background:'rgba(0,0,0,.7)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
    modal:  { background:'#161B24', border:'1px solid rgba(255,255,255,.1)', borderRadius:14, padding:24, width:'100%', maxWidth:440 },
  }

  return (
    <div style={S.page}>
      <a href="/settings" style={{ fontSize:12, color:'#7C8BA0', textDecoration:'none', display:'block', marginBottom:20 }}>← Settings</a>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={S.title}>Staff</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>{users.filter(u=>u.active).length} active · {users.filter(u=>!u.active).length} inactive</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email..." style={{ padding:'7px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#DDE3EE', fontSize:11, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={()=>window.location.href='/settings/users/new'} style={{ padding:'7px 14px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Invite Staff</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ overflowX:'auto' }}>
          {loading ? <div style={{ textAlign:'center', padding:40, color:'#7C8BA0' }}>Loading...</div> : (
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:560 }}>
              <thead><tr>{['Name','Email','Role','Team','Telegram','Status','Actions'].map(h=><th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} style={{ opacity: u.active?1:0.5 }}>
                    <td style={{ ...S.td, fontWeight:700, color:'#F0F4FF' }}>{u.full_name}</td>
                    <td style={{ ...S.td, color:'#7C8BA0', fontFamily:'monospace', fontSize:10 }}>{u.email}</td>
                    <td style={S.td as any}>
                      <span style={{ padding:'2px 8px', borderRadius:100, fontFamily:'monospace', fontSize:8, background:(ROLE_COLOR[u.role]||'#7C8BA0')+'18', color:ROLE_COLOR[u.role]||'#7C8BA0', border:`1px solid ${(ROLE_COLOR[u.role]||'#7C8BA0')}33` }}>
                        {u.role?.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:'#7C8BA0' }}>{u.team ? `Team ${u.team}` : '—'}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color: u.telegram_id?'#1DB870':'#48536A' }}>
                      {u.telegram_id ? `@${u.telegram_id}` : 'Not linked'}
                    </td>
                    <td style={S.td as any}>
                      <span style={{ padding:'2px 8px', borderRadius:100, fontFamily:'monospace', fontSize:8, background:u.active?'rgba(29,184,112,.1)':'rgba(72,83,106,.1)', color:u.active?'#1DB870':'#7C8BA0', border:`1px solid ${u.active?'rgba(29,184,112,.2)':'rgba(72,83,106,.2)'}` }}>
                        {u.active?'Active':'Inactive'}
                      </span>
                    </td>
                    <td style={S.td as any}>
                      <div style={{ display:'flex', gap:4 }}>
                        <button style={{ ...S.btn, background:'rgba(29,111,232,.1)', color:'#4D9EFF' }} onClick={()=>setEditing(u)}>Edit</button>
                        {u.active && <button style={{ ...S.btn, background:'rgba(217,79,79,.08)', color:'#D94F4F' }} onClick={()=>deactivate(u.id)}>Deactivate</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setEditing(null)}}>
          <div style={S.modal}>
            <div style={{ fontSize:15, fontWeight:700, color:'#F0F4FF', marginBottom:16 }}>Edit — {editing.full_name}</div>
            <div style={{ marginBottom:10 }}>
              <label style={S.label}>Role</label>
              <select style={{ ...S.input, appearance:'none' }} value={editing.role} onChange={e=>setEditing((u:any)=>({...u,role:e.target.value}))}>
                {['owner','gm','shop_manager','service_writer','technician','parts_manager','fleet_manager','maintenance_manager','maintenance_technician','accountant','office_admin','dispatcher','driver','customer','it_person'].map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={S.label}>Team</label>
              <select style={{ ...S.input, appearance:'none' }} value={editing.team||''} onChange={e=>setEditing((u:any)=>({...u,team:e.target.value||null}))}>
                <option value="">No team</option>
                {['A','B','C','D'].map(t=><option key={t} value={t}>Team {t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={S.label}>Telegram ID (username without @)</label>
              <input style={S.input} placeholder="their_telegram_username" value={editing.telegram_id||''} onChange={e=>setEditing((u:any)=>({...u,telegram_id:e.target.value||null}))}/>
              <div style={{ fontSize:10, color:'#48536A', marginTop:4 }}>They must send /start to @servicewriter first to activate.</div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:14, borderTop:'1px solid rgba(255,255,255,.06)' }}>
              <button style={{ ...S.btn, background:'transparent', color:'#7C8BA0', border:'1px solid rgba(255,255,255,.08)', padding:'8px 16px' }} onClick={()=>setEditing(null)}>Cancel</button>
              <button style={{ ...S.btn, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', color:'#fff', padding:'8px 16px' }} onClick={saveUser} disabled={saving}>{saving?'Saving...':'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
