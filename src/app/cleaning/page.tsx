'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const DEFAULT_ZONES = [
  { name:'Bay 1-4 — Engine Team',  icon:'', team:'A', checklist:['Sweep floor','Degrease floor drains','Clean tool chests','Wipe down benches','Stack used oil filters','Dispose rags','Check fire extinguisher'] },
  { name:'Bay 5-8 — Electrical',   icon:'', team:'B', checklist:['Sweep floor','Clean diagnostic area','Coil all cables','Wipe down benches','Empty trash','Clean windows'] },
  { name:'Bay 9-10 — Body/Chassis',icon:'', team:'C', checklist:['Sweep floor','Stack used parts','Clean welding area','Wipe down benches','Empty trash','Check PPE supplies'] },
  { name:'Bay 11-12 — Inspection', icon:'', team:'D', checklist:['Sweep floor','Clean inspection pit','Wipe down equipment','Organize cones/markers','Check lighting','Empty trash'] },
  { name:'Parts Room',             icon:'', team:'',  checklist:['Sweep floor','Organize bins','Check expiry on fluids','Clean shelving','Restock gloves/rags','Update bin labels'] },
  { name:'Waiting Area',           icon:'', team:'',  checklist:['Vacuum/sweep floor','Wipe down chairs','Clean windows','Restock coffee/water','Clean restroom','Take out trash'] },
]

export default function CleaningPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user,     setUser]     = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [active,   setActive]   = useState<string | null>(null)  // zone name being cleaned
  const [checks,   setChecks]   = useState<Record<string, boolean>>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)
      // Load today's completed sessions
      const { data } = await supabase.from('cleaning_sessions')
        .select('*, cleaning_zones(name, icon)')
        .eq('shop_id', profile.shop_id)
        .gte('started_at', today)
        .order('started_at', { ascending: false })
      setSessions(data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function startZone(zone: typeof DEFAULT_ZONES[0]) {
    setActive(zone.name)
    setChecks({})
  }

  async function completeZone(zone: typeof DEFAULT_ZONES[0]) {
    setSaving(true)
    const done  = zone.checklist.filter(item => checks[item]).length
    const total = zone.checklist.length
    const score = Math.round(done / total * 100)

    // Log to cleaning_sessions
    const { data: zoneRecord } = await supabase.from('cleaning_zones')
      .select('id').eq('shop_id', user.shop_id).eq('name', zone.name).single()

    await supabase.from('cleaning_sessions').insert({
      shop_id:         user.shop_id,
      zone_id:         zoneRecord?.id || null,
      assigned_to:     user.id,
      status:          score === 100 ? 'completed' : 'completed',
      checklist_state: checks,
      items_total:     total,
      items_done:      done,
      score,
      started_at:      new Date().toISOString(),
      completed_at:    new Date().toISOString(),
      duration_minutes:15,
    })

    setSessions(prev => [{
      id: Date.now().toString(),
      score,
      items_done: done,
      items_total: total,
      cleaning_zones: { name: zone.name, icon: zone.icon },
    }, ...prev])
    setActive(null)
    setSaving(false)
  }

  const completedToday = (zoneName: string) => sessions.some(s => s.cleaning_zones?.name === zoneName)

  const S: Record<string, React.CSSProperties> = {
    page:  { background:t.bg, minHeight:'100vh', color:t.text, fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:t.text, marginBottom:4 },
    card:  { background:t.bgCard, border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:16, marginBottom:10 },
  }

  // Active zone checklist view
  if (active) {
    const zone = DEFAULT_ZONES.find(z => z.name === active)!
    const done = zone.checklist.filter(item => checks[item]).length
    return (
      <div style={{ ...S.page, maxWidth:480, margin:'0 auto' }}>
        <button onClick={() => setActive(null)} style={{ fontSize:12, color:t.textSecondary, background:'none', border:'none', cursor:'pointer', marginBottom:20, fontFamily:'inherit' }}>← Back</button>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:t.text, marginBottom:4 }}>{zone.icon} {zone.name}</div>
        <div style={{ fontSize:12, color:t.textSecondary, marginBottom:20 }}>{done}/{zone.checklist.length} items complete</div>

        {/* Progress */}
        <div style={{ height:6, background:t.inputBg, borderRadius:100, marginBottom:20, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${done/zone.checklist.length*100}%`, background:'linear-gradient(90deg,#1D6FE8,#1DB870)', borderRadius:100, transition:'width .2s' }}/>
        </div>

        {zone.checklist.map(item => (
          <div key={item} onClick={() => setChecks(c => ({ ...c, [item]: !c[item] }))}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background: checks[item]?'rgba(29,184,112,.06)':t.bgCard, border:`1px solid ${checks[item]?'rgba(29,184,112,.2)':t.border}`, borderRadius:10, marginBottom:8, cursor:'pointer' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${checks[item]?'#1DB870':t.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: checks[item]?'#1DB870':'transparent', color:'#fff', fontSize:12, fontWeight:700 }}>
              {checks[item] ? '✓' : ''}
            </div>
            <span style={{ fontSize:13, color: checks[item]?'#DDE3EE':t.textSecondary, textDecoration: checks[item]?'line-through':'none' }}>{item}</span>
          </div>
        ))}

        <button onClick={() => completeZone(zone)} disabled={saving}
          style={{ width:'100%', marginTop:12, padding:14, background: done===zone.checklist.length?'linear-gradient(135deg,#1DB870,#14875A)':t.accent, border:'none', borderRadius:12, fontSize:14, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity:saving?0.7:1 }}>
          {saving ? 'Saving...' : done===zone.checklist.length ? 'Mark Zone Clean' : `Submit (${done}/${zone.checklist.length} done)`}
        </button>
      </div>
    )
  }

  const totalZones     = DEFAULT_ZONES.length
  const completedCount = DEFAULT_ZONES.filter(z => completedToday(z.name)).length

  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={S.title}>Shop Cleaning</div>
          <div style={{ fontSize:12, color:t.textSecondary }}>{completedCount}/{totalZones} zones clean today</div>
        </div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color: completedCount===totalZones?'#1DB870':completedCount>0?'#D4882A':t.textSecondary }}>
          {Math.round(completedCount/totalZones*100)}%
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{ height:6, background:t.inputBg, borderRadius:100, marginBottom:20, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${completedCount/totalZones*100}%`, background:'linear-gradient(90deg,#1D6FE8,#1DB870)', borderRadius:100, transition:'width .3s' }}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:10 }}>
        {DEFAULT_ZONES.map(zone => {
          const done = completedToday(zone.name)
          const session = sessions.find(s => s.cleaning_zones?.name === zone.name)
          return (
            <div key={zone.name} style={{ ...S.card, border:`1px solid ${done?'rgba(29,184,112,.2)':t.border}`, background: done?'rgba(29,184,112,.04)':t.bgCard }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:20, marginBottom:4 }}>{zone.icon}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:t.text }}>{zone.name}</div>
                  {zone.team && <div style={{ fontSize:10, color:t.textTertiary, marginTop:2 }}>Team {zone.team}</div>}
                </div>
                {done && (
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1DB870' }}>Done</div>
                    <div style={{ fontSize:10, color:'#1DB870', fontFamily:'monospace', marginTop:2 }}>{session?.score}%</div>
                  </div>
                )}
              </div>
              <div style={{ fontSize:10, color:t.textSecondary, marginBottom:12 }}>{zone.checklist.length} items</div>
              {!done && (
                <button onClick={() => startZone(zone)}
                  style={{ width:'100%', padding:'9px 0', background:'rgba(29,111,232,.1)', border:'1px solid rgba(29,111,232,.25)', borderRadius:8, color:'#4D9EFF', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  Start Cleaning
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
