'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const TABS = ['Shop','Users','Integrations','Notifications','Billing']

export default function SettingsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState('Shop')
  const [shop, setShop] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href='/login'; return }
      if (!['owner','gm','it_person','office_admin'].includes(profile.role)) { window.location.href='/dashboard'; return }
      setUser(profile)
      const { data } = await supabase.from('shops').select('*').eq('id', profile.shop_id).single()
      if (data) setShop(data)
    }
    load()
  }, [])

  async function saveShop() {
    setSaving(true)
    await supabase.from('shops').update({ name:shop.name, dba:shop.dba, phone:shop.phone, email:shop.email, address:shop.address, state:shop.state, county:shop.county, tax_rate:parseFloat(shop.tax_rate)||0, tax_labor:shop.tax_labor||false }).eq('id', shop.id)
    setSaving(false)
    alert('Saved')
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:20 },
    tabs:  { display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid rgba(255,255,255,.06)', paddingBottom:0 },
    tab:   { padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', borderBottom:'2px solid transparent', color:'#7C8BA0' },
    on:    { color:'#4D9EFF', borderBottomColor:'#4D9EFF' },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#7C8BA0', marginBottom:4, display:'block', marginTop:10 },
    input: { width:'100%', padding:'9px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    btn:   { padding:'10px 20px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:16 },
    card:  { background:'#161B24', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:20, maxWidth:540 },
  }

  return (
    <div style={S.page}>
      <div style={S.title}>Settings</div>
      <div style={S.tabs}>
        {TABS.map(t => <div key={t} style={{...S.tab,...(tab===t?S.on:{})}} onClick={() => setTab(t)}>{t}</div>)}
      </div>
      {tab === 'Shop' && (
        <div style={S.card}>
          <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:14 }}>Shop Information</div>
          <label style={S.label}>Legal Name</label>
          <input style={S.input} value={shop.name||''} onChange={e => setShop((s:any) => ({...s, name:e.target.value}))}/>
          <label style={S.label}>DBA / Display Name</label>
          <input style={S.input} value={shop.dba||''} onChange={e => setShop((s:any) => ({...s, dba:e.target.value}))}/>
          <label style={S.label}>Phone</label>
          <input style={S.input} value={shop.phone||''} onChange={e => setShop((s:any) => ({...s, phone:e.target.value}))}/>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={shop.email||''} onChange={e => setShop((s:any) => ({...s, email:e.target.value}))}/>
          <label style={S.label}>Address</label>
          <input style={S.input} value={shop.address||''} onChange={e => setShop((s:any) => ({...s, address:e.target.value}))}/>

          <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Tax & Location</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={S.label}>State</label>
                <input style={S.input} value={shop.state||''} onChange={e => setShop((s:any) => ({...s, state:e.target.value}))} placeholder="Illinois"/>
              </div>
              <div>
                <label style={S.label}>County / City</label>
                <input style={S.input} value={shop.county||''} onChange={e => setShop((s:any) => ({...s, county:e.target.value}))} placeholder="Cook"/>
              </div>
              <div>
                <label style={S.label}>Tax Rate %</label>
                <input style={S.input} type="number" step="0.01" value={shop.tax_rate||''} onChange={e => setShop((s:any) => ({...s, tax_rate:e.target.value}))} placeholder="10.25"/>
              </div>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#DDE3EE', cursor:'pointer' }}>
              <input type="checkbox" checked={shop.tax_labor||false} onChange={e => setShop((s:any) => ({...s, tax_labor:e.target.checked}))} style={{ width:16, height:16 }}/>
              Tax labor (default: off — most states only tax parts)
            </label>
          </div>

          <button style={{ ...S.btn, marginTop:16 }} onClick={saveShop} disabled={saving}>{saving?'Saving...':'Save Changes'}</button>

          <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:8 }}>Kiosk Mode</div>
            <div style={{ fontSize:11, color:'#7C8BA0', marginBottom:12 }}>Open the self-service check-in kiosk on a tablet in your waiting area. Supports English, Russian, and Uzbek.</div>
            <div style={{ display:'flex', gap:8 }}>
              <a href={`/kiosk?shop=${shop.id}`} target="_blank" rel="noopener"
                style={{ padding:'10px 20px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:700, textDecoration:'none', display:'inline-block' }}>
                Open Kiosk
              </a>
              <button onClick={() => { navigator.clipboard.writeText(`https://truckzen.pro/kiosk?shop=${shop.id}`); alert('Kiosk URL copied!') }}
                style={{ padding:'10px 16px', background:'transparent', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#7C8BA0', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                Copy URL
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === 'Users' && (() => { window.location.href = '/settings/users'; return <div style={{ color:'#7C8BA0', padding:40, textAlign:'center' }}>Redirecting to Team Members...</div> })()}
      {tab === 'Integrations' && (
        <div style={S.card}>
          <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:14 }}>Connected Services</div>
          {[
            { name:'Stripe', status:'Connect', desc:'Payment processing' },
            { name:'QuickBooks Online', status:'Connect', desc:'Accounting sync' },
            { name:'Twilio', status:'Connect', desc:'SMS notifications' },
            { name:'FinditParts', status:'Connect', desc:'Parts catalog' },
            { name:'Samsara GPS', status:'Connect', desc:'Fleet tracking' },
          ].map(int => (
            <div key={int.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#F0F4FF' }}>{int.name}</div>
                <div style={{ fontSize:10, color:'#7C8BA0' }}>{int.desc}</div>
              </div>
              <button style={{ padding:'5px 12px', borderRadius:7, background:'rgba(29,111,232,.1)', border:'1px solid rgba(29,111,232,.25)', color:'#4D9EFF', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{int.status}</button>
            </div>
          ))}
        </div>
      )}
      {tab !== 'Shop' && tab !== 'Users' && tab !== 'Integrations' && (
        <div style={{ color:'#7C8BA0', fontSize:13 }}>{tab} settings — coming soon</div>
      )}

      {/* Account & Security — always visible at bottom */}
      <div style={{ ...S.card, marginTop:32, maxWidth:540, borderColor:'rgba(239,68,68,.15)' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:14 }}>Account & Security</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
            <span style={{ color:'#7C8BA0' }}>Logged in as</span>
            <span style={{ color:'#F0F4FF', fontWeight:600 }}>{user?.email}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
            <span style={{ color:'#7C8BA0' }}>Role</span>
            <span style={{ color:'#4D9EFF', fontWeight:600 }}>{user?.role?.replace(/_/g,' ').replace(/\b\w/g, (c:string) => c.toUpperCase())}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
            <span style={{ color:'#7C8BA0' }}>Company</span>
            <span style={{ color:'#F0F4FF', fontWeight:600 }}>{shop?.dba || shop?.name || '—'}</span>
          </div>
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          style={{ width:'100%', padding:'13px 20px', background:'#EF4444', border:'none', borderRadius:9, fontSize:14, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}