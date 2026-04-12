'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { CheckCircle, XCircle } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const GREEN = '#1DB870', RED = '#D94F4F', AMBER = '#D4882A', MUTED = '#7C8BA0'

export default function InspectionDetailPage() {
  const { tokens: t } = useTheme()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [inspection, setInspection] = useState<any>(null)
  const [defects, setDefects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const [{ data: i }, { data: d }] = await Promise.all([
        supabase.from('maint_inspections').select('*, assets(unit_number, year, make, model), maint_drivers(full_name), maint_inspection_templates(name)').eq('id', params.id).single(),
        supabase.from('maint_inspection_defects').select('*').eq('inspection_id', params.id).order('created_at'),
      ])
      if (!i) { router.push('/maintenance/inspections'); return }
      setInspection(i)
      setDefects(d || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function resolveDefect(defectId: string) {
    await fetch('/api/maintenance/crud', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_inspection_defects', id: defectId, resolved: true, resolved_date: new Date().toISOString() }),
    })
    setDefects(d => d.map(x => x.id === defectId ? { ...x, resolved: true, resolved_date: new Date().toISOString() } : x))
  }

  if (loading) return <div style={{ background: t.bg, minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const asset = inspection.assets || {}
  const driver = inspection.maint_drivers || {}
  const template = inspection.maint_inspection_templates || {}
  const responses = inspection.responses || []

  const S: Record<string, React.CSSProperties> = {
    card: { background: t.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 16, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: t.textTertiary },
  }

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text }}>Inspection Detail</div>
          <div style={{ fontSize: 13, color: MUTED }}>
            {template.name || inspection.type} · #{asset.unit_number} {asset.year} {asset.make} · {driver.full_name || '—'}
          </div>
        </div>
        <span style={{ padding: '6px 16px', borderRadius: 100, fontFamily: MONO, fontSize: 12, fontWeight: 700, background: inspection.overall_result === 'pass' ? `${GREEN}18` : `${RED}18`, color: inspection.overall_result === 'pass' ? GREEN : RED }}>
          {inspection.overall_result?.toUpperCase()}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, alignItems: 'start' }}>
        <div>
          {/* Checklist Results */}
          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Checklist Results</div>
            {Array.isArray(responses) && responses.length > 0 ? (
              (() => {
                const grouped: Record<string, any[]> = {}
                responses.forEach((r: any) => { if (!grouped[r.category]) grouped[r.category] = []; grouped[r.category].push(r) })
                return Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>{cat}</div>
                    {items.map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                        {item.pass ? <CheckCircle size={14} color={GREEN} /> : <XCircle size={14} color={RED} />}
                        <span style={{ fontSize: 12, color: t.text, flex: 1 }}>{item.name}</span>
                        {item.notes && <span style={{ fontSize: 10, color: RED }}>{item.notes}</span>}
                      </div>
                    ))}
                  </div>
                ))
              })()
            ) : (
              <div style={{ textAlign: 'center', padding: 16, color: t.textTertiary, fontSize: 12 }}>No checklist data</div>
            )}
          </div>

          {/* Defects */}
          {defects.length > 0 && (
            <div style={S.card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: RED, marginBottom: 12 }}>Defects ({defects.length})</div>
              {defects.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{d.item_name}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{d.category} · {d.severity}</div>
                    {d.description && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{d.description}</div>}
                  </div>
                  {d.resolved ? (
                    <span style={{ fontSize: 9, fontWeight: 700, color: GREEN, background: `${GREEN}18`, padding: '2px 8px', borderRadius: 4 }}>RESOLVED</span>
                  ) : (
                    <button onClick={() => resolveDefect(d.id)} style={{ padding: '4px 10px', background: `${GREEN}18`, border: `1px solid ${GREEN}33`, borderRadius: 6, color: GREEN, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Resolve</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Details</div>
          {[
            { label: 'Date', val: inspection.inspection_date ? new Date(inspection.inspection_date).toLocaleString() : '—' },
            { label: 'Type', val: inspection.type },
            { label: 'Truck', val: `#${asset.unit_number} ${asset.make} ${asset.model}` },
            { label: 'Driver', val: driver.full_name || '—' },
            { label: 'Odometer', val: inspection.odometer ? `${inspection.odometer.toLocaleString()} mi` : '—' },
            { label: 'Status', val: inspection.status },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 12 }}>
              <span style={{ color: t.textTertiary }}>{r.label}</span><span style={{ color: t.text }}>{r.val}</span>
            </div>
          ))}
          {inspection.notes && <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>{inspection.notes}</div>}
        </div>
      </div>
    </div>
  )
}
