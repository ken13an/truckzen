'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

export default function NewPMPage() {
  const { tokens: th } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [assets, setAssets] = useState<any[]>([])
  const [form, setForm] = useState({ asset_id:'', service_name:'', interval_miles:'', interval_days:'', next_due_date:'', next_due_reading:'', notes:'' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const PM_TEMPLATES = [
    { name:'Oil Change — 15W-40', miles:15000, days:90 },
    { name:'Full PM Service', miles:15000, days:90 },
    { name:'DOT Annual Inspection', miles:null, days:365 },
    { name:'Tire Rotation & Inspection', miles:30000, days:180 },
    { name:'Coolant Flush', miles:null, days:365 },
    { name:'Transmission Service', miles:50000, days:365 },
    { name:'DPF Cleaning', miles:150000, days:null },
    { name:'Brake Inspection', miles:25000, days:180 },
  ]

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const { data } = await supabase.from('assets').select('id, unit_number, year, make, model').eq('shop_id', profile.shop_id).eq('status','active').is('deleted_at', null).order('unit_number')
      setAssets(data || [])
    }
    load()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset_id)    { setError('Select a vehicle'); return }
    if (!form.service_name){ setError('Service name required'); return }
    if (!form.interval_miles && !form.interval_days) { setError('Set at least one interval (miles or days)'); return }
    setSaving(true); setError('')

    const profile = await getCurrentUser(supabase)
    const { data, error: err } = await supabase.from('pm_schedules').insert({
      shop_id:          profile!.shop_id,
      asset_id:         form.asset_id,
      service_name:     form.service_name,
      interval_miles:   form.interval_miles ? parseInt(form.interval_miles) : null,
      interval_days:    form.interval_days  ? parseInt(form.interval_days)  : null,
      next_due_date:    form.next_due_date  || null,
      next_due_reading: form.next_due_reading ? parseInt(form.next_due_reading) : null,
      notes:            form.notes || null,
      active:           true,
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/maintenance/${data.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'var(--tz-bg)', minHeight:'100vh', color:'var(--tz-text)', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:640, margin:'0 auto' },
    card:  { background:'var(--tz-bgCard)', border:`1px solid ${'var(--tz-border)'}`, borderRadius:12, padding:20, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'var(--tz-textTertiary)', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'9px 12px', background:'var(--tz-inputBg)', border:`1px solid ${'var(--tz-border)'}`, borderRadius:8, fontSize:12, color:'var(--tz-text)', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    btn:   { padding:'12px 24px', background:'var(--tz-accent)', border:'none', borderRadius:9, fontSize:13, fontWeight:700, color:'var(--tz-bgLight)', cursor:'pointer', fontFamily:'inherit' },
    error: { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:'#D94F4F', marginBottom:12 },
    chip:  { padding:'5px 12px', borderRadius:100, fontSize:10, fontWeight:600, cursor:'pointer', border:`1px solid ${'var(--tz-border)'}`, background:'var(--tz-inputBg)', color:'var(--tz-textSecondary)', fontFamily:'inherit', transition:'all .13s', minHeight:30 },
  }

  return (
    <div style={S.page}>
      <a href="/maintenance" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--tz-border)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: 'var(--tz-text)', textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Maintenance
</a>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'var(--tz-text)', marginBottom:4 }}>New PM Schedule</div>
      <div style={{ fontSize:12, color:'var(--tz-textSecondary)', marginBottom:20 }}>Set up a recurring maintenance schedule for a vehicle.</div>

      {error && <div style={S.error}>{error}</div>}

      {/* Quick templates */}
      <div style={S.card}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--tz-text)', marginBottom:10 }}>Quick Templates</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {PM_TEMPLATES.map(t => (
            <button key={t.name} type="button" style={S.chip}
              onClick={() => setForm(f => ({ ...f, service_name:t.name, interval_miles:t.miles?String(t.miles):'', interval_days:t.days?String(t.days):'' }))}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--tz-text)', marginBottom:12 }}>Schedule Details</div>

          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Vehicle *</label>
            <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.asset_id} onChange={e=>setForm(f=>({...f,asset_id:e.target.value}))}>
              <option value="">Select truck...</option>
              {assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} — {a.year} {a.make} {a.model}</option>)}
            </select>
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Service Name *</label>
            <input style={S.input} value={form.service_name} onChange={e=>setForm(f=>({...f,service_name:e.target.value}))} placeholder="e.g. Oil Change 15W-40"/>
          </div>

          <div style={{ fontSize:11, color:'var(--tz-textTertiary)', marginBottom:8 }}>Set one or both intervals — alert triggers when either is reached first.</div>
          <div style={S.row2}>
            <div><label style={S.label}>Every X Miles</label><input style={S.input} type="number" placeholder="e.g. 15000" value={form.interval_miles} onChange={e=>setForm(f=>({...f,interval_miles:e.target.value}))}/></div>
            <div><label style={S.label}>Every X Days</label><input style={S.input} type="number" placeholder="e.g. 90" value={form.interval_days} onChange={e=>setForm(f=>({...f,interval_days:e.target.value}))}/></div>
          </div>

          <div style={{ fontSize:12, fontWeight:600, color:'var(--tz-text)', margin:'14px 0 10px' }}>Next Service Due</div>
          <div style={S.row2}>
            <div><label style={S.label}>Due Date</label><input style={S.input} type="date" value={form.next_due_date} onChange={e=>setForm(f=>({...f,next_due_date:e.target.value}))}/></div>
            <div><label style={S.label}>Due Mileage</label><input style={S.input} type="number" placeholder="e.g. 487500" value={form.next_due_reading} onChange={e=>setForm(f=>({...f,next_due_reading:e.target.value}))}/></div>
          </div>

          <div>
            <label style={S.label}>Notes</label>
            <textarea style={{ ...S.input, minHeight:64, resize:'vertical' as const }} placeholder="Any special instructions..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
          </div>
        </div>

        <button type="submit" style={{ ...S.btn, width:'100%' }} disabled={saving}>{saving?'Creating...':'Create PM Schedule →'}</button>
      </form>
    </div>
  )
}
