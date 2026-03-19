'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const STEPS = ['Shop Info', 'Teams & Bays', 'Invite Staff', 'Parts Setup', 'Done']

export default function SetupPage() {
  const supabase = createClient()
  const [step,    setStep]    = useState(0)
  const [saving,  setSaving]  = useState(false)
  const [shopData, setShopData] = useState({ name:'', dba:'', phone:'', email:'', address:'', city:'', state:'TX', zip:'' })
  const [staffRows, setStaffRows] = useState([{ full_name:'', email:'', role:'technician', team:'A' }])

  async function saveShop() {
    setSaving(true)
    const profile = await getCurrentUser(supabase)
    if (!profile) return
    await supabase.from('shops').update({
      name: shopData.name, dba: shopData.dba,
      phone: shopData.phone, email: shopData.email,
      address: shopData.address, city: shopData.city,
      state: shopData.state, zip: shopData.zip,
    }).eq('id', profile.shop_id)
    setSaving(false)
    setStep(1)
  }

  async function inviteStaff() {
    setSaving(true)
    const profile = await getCurrentUser(supabase)
    if (!profile) return
    for (const row of staffRows) {
      if (!row.email || !row.full_name) continue
      const { data: auth } = await supabase.auth.admin.createUser({
        email: row.email, email_confirm: true,
        user_metadata: { full_name: row.full_name },
      })
      if (auth.user) {
        await supabase.from('users').insert({
          id: auth.user.id, shop_id: profile.shop_id,
          full_name: row.full_name, email: row.email,
          role: row.role, team: row.team,
        })
      }
    }
    setSaving(false)
    setStep(3)
  }

  async function completeSetup() {
    setSaving(true)
    const profile = await getCurrentUser(supabase)
    if (!profile) return
    await supabase.from('shops').update({ setup_complete: true }).eq('id', profile.shop_id)
    setSaving(false)
    window.location.href = '/dashboard'
  }

  const S: Record<string, React.CSSProperties> = {
    page:    { minHeight:'100vh', background:'#060708', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 },
    card:    { width:'100%', maxWidth:560, background:'#161B24', border:'1px solid rgba(255,255,255,.08)', borderRadius:16, padding:'32px 28px', boxShadow:'0 24px 64px rgba(0,0,0,.5)' },
    steps:   { display:'flex', gap:6, marginBottom:28 },
    stepDot: { flex:1, height:4, borderRadius:100, background:'rgba(255,255,255,.08)', transition:'all .2s' },
    stepOn:  { background:'#1D6FE8' },
    stepDone:{ background:'#1DB870' },
    title:   { fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:'.02em', color:'#F0F4FF', marginBottom:6 },
    sub:     { fontSize:12, color:'#7C8BA0', marginBottom:20, lineHeight:1.5 },
    label:   { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#7C8BA0', marginBottom:4, display:'block' },
    input:   { width:'100%', padding:'9px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const, marginBottom:10 },
    btn:     { padding:'12px 24px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:9, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', marginTop:8 },
    grid2:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  }

  const input = (label: string, key: keyof typeof shopData, placeholder = '') => (
    <div>
      <label style={S.label}>{label}</label>
      <input style={S.input} value={shopData[key]} placeholder={placeholder}
        onChange={e => setShopData(d => ({ ...d, [key]: e.target.value }))}/>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24 }}>
          <div style={{ width:28, height:28, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:'.1em', color:'#F0F4FF' }}>
            TRUCK<span style={{ color:'#4D9EFF' }}>ZEN</span>
          </span>
          <span style={{ marginLeft:'auto', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#7C8BA0' }}>Step {step + 1} of {STEPS.length}</span>
        </div>

        {/* Progress */}
        <div style={S.steps}>
          {STEPS.map((_, i) => <div key={i} style={{ ...S.stepDot, ...(i < step ? S.stepDone : i === step ? S.stepOn : {}) }}/>)}
        </div>

        {/* STEP 0: Shop Info */}
        {step === 0 && (
          <>
            <div style={S.title}>Shop Information</div>
            <div style={S.sub}>Tell us about your shop. This appears on invoices and customer communications.</div>
            {input('Legal Business Name', 'name', 'Bay 1 Truck Service LLC')}
            {input('DBA / Shop Name', 'dba', 'UGL Shop Main')}
            <div style={S.grid2}>
              {input('Phone', 'phone', '(713) 448-2901')}
              {input('Email', 'email', 'service@yourshop.com')}
            </div>
            {input('Street Address', 'address', '4820 Gulf Freeway')}
            <div style={S.grid2}>
              {input('City', 'city', 'Houston')}
              {input('ZIP', 'zip', '77023')}
            </div>
            <button style={S.btn} onClick={saveShop} disabled={saving || !shopData.name}>
              {saving ? 'Saving...' : 'Save & Continue →'}
            </button>
          </>
        )}

        {/* STEP 1: Teams */}
        {step === 1 && (
          <>
            <div style={S.title}>Teams & Bays</div>
            <div style={S.sub}>Your shop is already configured with 4 teams and 12 bays. You can adjust anytime in Settings.</div>
            {[
              { team:'A', bays:'Bays 1–4', dept:'Engine & Diagnostics', color:'#4D9EFF' },
              { team:'B', bays:'Bays 5–8', dept:'Electrical', color:'#8B5CF6' },
              { team:'C', bays:'Bays 9–10', dept:'Body & Chassis', color:'#E8692A' },
              { team:'D', bays:'Bays 11–12', dept:'Inspection', color:'#1DB870' },
            ].map(t => (
              <div key={t.team} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:9, marginBottom:8 }}>
                <div style={{ width:28, height:28, borderRadius:7, background:`${t.color}20`, border:`1px solid ${t.color}33`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:t.color }}>{t.team}</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF' }}>Team {t.team} — {t.dept}</div>
                  <div style={{ fontSize:10, color:'#7C8BA0' }}>{t.bays}</div>
                </div>
              </div>
            ))}
            <button style={S.btn} onClick={() => setStep(2)}>Looks Good →</button>
          </>
        )}

        {/* STEP 2: Invite Staff */}
        {step === 2 && (
          <>
            <div style={S.title}>Invite Your Team</div>
            <div style={S.sub}>Add staff accounts. They'll receive a welcome email with login instructions. You can add more later in Settings → Users.</div>
            {staffRows.map((row, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 120px 80px 24px', gap:6, marginBottom:8, alignItems:'center' }}>
                <input style={{ ...S.input, marginBottom:0, fontSize:11 }} placeholder="Full name" value={row.full_name}
                  onChange={e => setStaffRows(rows => rows.map((r,j) => j===i ? {...r, full_name: e.target.value} : r))}/>
                <input style={{ ...S.input, marginBottom:0, fontSize:11 }} placeholder="Email" value={row.email}
                  onChange={e => setStaffRows(rows => rows.map((r,j) => j===i ? {...r, email: e.target.value} : r))}/>
                <select style={{ ...S.input, marginBottom:0, fontSize:10, appearance:'none' as any }} value={row.role}
                  onChange={e => setStaffRows(rows => rows.map((r,j) => j===i ? {...r, role: e.target.value} : r))}>
                  <option value="technician">Tech</option>
                  <option value="parts_manager">Parts</option>
                  <option value="fleet_manager">Fleet</option>
                  <option value="accountant">Accountant</option>
                  <option value="office_admin">Admin</option>
                  <option value="driver">Driver</option>
                </select>
                <select style={{ ...S.input, marginBottom:0, fontSize:10, appearance:'none' as any }} value={row.team}
                  onChange={e => setStaffRows(rows => rows.map((r,j) => j===i ? {...r, team: e.target.value} : r))}>
                  {['A','B','C','D'].map(t => <option key={t} value={t}>Team {t}</option>)}
                </select>
                {staffRows.length > 1 && (
                  <div style={{ cursor:'pointer', color:'#D94F4F', textAlign:'center' as const }}
                    onClick={() => setStaffRows(rows => rows.filter((_,j) => j!==i))}>×</div>
                )}
              </div>
            ))}
            <button style={{ ...S.btn, background:'transparent', border:'1px dashed rgba(29,111,232,.3)', color:'#4D9EFF', marginBottom:8, display:'block', width:'100%', textAlign:'center' as const }}
              onClick={() => setStaffRows(r => [...r, { full_name:'', email:'', role:'technician', team:'A' }])}>
              + Add Another
            </button>
            <button style={S.btn} onClick={inviteStaff} disabled={saving}>
              {saving ? 'Inviting...' : 'Send Invites & Continue →'}
            </button>
            <button style={{ ...S.btn, background:'transparent', color:'#7C8BA0', marginLeft:8 }} onClick={() => setStep(3)}>
              Skip for now
            </button>
          </>
        )}

        {/* STEP 3: Parts */}
        {step === 3 && (
          <>
            <div style={S.title}>Parts Department</div>
            <div style={S.sub}>Your parts catalog is ready. Import your existing inventory using Smart Drop, or add parts manually in the Parts Department.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {[
                { icon:'📂', label:'Smart Drop — import from Excel/CSV', sub:'Upload your existing parts list — AI maps the columns automatically' },
                { icon:'➕', label:'Add parts manually', sub:'Add parts one by one in Parts → Inventory' },
                { icon:'⏭️', label:'Skip — add parts later', sub:'Start using TruckZen now, import parts when ready' },
              ].map(opt => (
                <div key={opt.label} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:9, cursor:'pointer' }}
                  onClick={() => setStep(4)}>
                  <span style={{ fontSize:18 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#F0F4FF' }}>{opt.label}</div>
                    <div style={{ fontSize:10, color:'#7C8BA0', marginTop:2 }}>{opt.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* STEP 4: Done */}
        {step === 4 && (
          <>
            <div style={{ textAlign:'center' as const, padding:'10px 0' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
              <div style={S.title}>TruckZen is ready</div>
              <div style={{ fontSize:13, color:'#7C8BA0', lineHeight:1.7, marginBottom:24 }}>
                Your shop is set up. Kiosk is live at <strong style={{ color:'#4D9EFF' }}>truckzen.com/kiosk</strong>.<br/>
                Staff accounts have been created. Data migration is ready to run.<br/>
                Everything is connected and waiting for your first job.
              </div>
              <button style={{ ...S.btn, display:'block', width:'100%', fontSize:15, padding:14 }}
                onClick={completeSetup} disabled={saving}>
                {saving ? 'Finishing...' : 'Open TruckZen →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
