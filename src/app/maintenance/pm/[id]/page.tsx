'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { CheckCircle } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = 'var(--tz-textSecondary)'

export default function PMDetailPage() {
  const { tokens: t } = useTheme()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [pm, setPM] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shopId, setShopId] = useState('')
  const [completeMiles, setCompleteMiles] = useState('')
  const [completeNotes, setCompleteNotes] = useState('')
  const [showComplete, setShowComplete] = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setShopId(profile.shop_id)
      const [{ data: p }, { data: h }] = await Promise.all([
        supabase.from('maint_pm_schedules').select('*, assets(unit_number, year, make, model, odometer)').eq('id', params.id).single(),
        supabase.from('maint_pm_history').select('*').eq('pm_schedule_id', params.id).order('completed_date', { ascending: false }),
      ])
      if (!p) { router.push('/maintenance/pm'); return }
      setPM(p)
      setHistory(h || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function markComplete() {
    setSaving(true)
    const completedDate = new Date().toISOString().split('T')[0]
    const miles = completeMiles ? parseInt(completeMiles) : null

    // Create history entry
    await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_pm_history', shop_id: shopId,
        pm_schedule_id: params.id, asset_id: pm.asset_id,
        completed_date: completedDate, completed_miles: miles,
        notes: completeNotes || null, cost: 0,
      }),
    })

    // Recalculate next due
    let nextDate: string | null = null
    let nextMiles: number | null = null
    if (pm.interval_days) {
      const d = new Date(completedDate)
      d.setDate(d.getDate() + pm.interval_days)
      nextDate = d.toISOString().split('T')[0]
    }
    if (pm.interval_miles && miles) {
      nextMiles = miles + pm.interval_miles
    }

    await fetch('/api/maintenance/crud', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_pm_schedules', id: params.id,
        last_completed_date: completedDate,
        last_completed_miles: miles,
        next_due_date: nextDate, next_due_miles: nextMiles,
      }),
    })

    setPM((p: any) => ({ ...p, last_completed_date: completedDate, last_completed_miles: miles, next_due_date: nextDate, next_due_miles: nextMiles }))
    setHistory(h => [{ completed_date: completedDate, completed_miles: miles, notes: completeNotes, id: Date.now() }, ...h])
    setShowComplete(false)
    setCompleteMiles('')
    setCompleteNotes('')
    setSaving(false)
  }

  if (loading) return <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const asset = pm.assets || {}
  const today = new Date().toISOString().split('T')[0]
  const isOver = pm.next_due_date && pm.next_due_date < today
  const isSoon = !isOver && pm.next_due_date && pm.next_due_date <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const stColor = isOver ? RED : isSoon ? AMBER : GREEN

  const S: Record<string, React.CSSProperties> = {
    card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tz-textTertiary)' },
    input: { width: '100%', padding: '8px 11px', background: 'var(--tz-inputBg)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 7, fontSize: 12, color: 'var(--tz-text)', outline: 'none', fontFamily: 'inherit', minHeight: 36, boxSizing: 'border-box' as const },
  }

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)' }}>{pm.custom_name || pm.service_type?.replace(/_/g, ' ')}</div>
          <div style={{ fontSize: 13, color: MUTED }}>#{asset.unit_number} {asset.year} {asset.make} {asset.model}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, background: `${stColor}18`, color: stColor }}>{isOver ? 'OVERDUE' : isSoon ? 'DUE SOON' : 'OK'} {pm.next_due_date ? `· ${pm.next_due_date}` : ''}</span>
            {pm.next_due_miles && <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, background: 'rgba(29,111,232,.1)', color: 'var(--tz-accentLight)' }}>{pm.next_due_miles.toLocaleString()} mi</span>}
          </div>
        </div>
        <button onClick={() => setShowComplete(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: `${GREEN}18`, border: `1px solid ${GREEN}33`, borderRadius: 8, color: GREEN, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
          <CheckCircle size={14} /> Mark Completed
        </button>
      </div>

      {showComplete && (
        <div style={{ ...S.card, border: `1px solid ${GREEN}33` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 10 }}>Complete This PM</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={S.label}>Odometer Reading</label><input style={S.input} type="number" value={completeMiles} onChange={e => setCompleteMiles(e.target.value)} placeholder={`Current: ${asset.odometer?.toLocaleString() || '—'}`} /></div>
            <div><label style={S.label}>Notes</label><input style={S.input} value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} placeholder="Any notes..." /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={markComplete} disabled={saving} style={{ padding: '8px 16px', background: GREEN, border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>{saving ? 'Saving...' : 'Confirm Complete'}</button>
            <button onClick={() => setShowComplete(false)} style={{ padding: '8px 16px', background: 'var(--tz-border)', border: 'none', borderRadius: 8, color: MUTED, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
        <div>
          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 12 }}>Schedule Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Service Type', val: pm.service_type?.replace(/_/g, ' ') },
                { label: 'Priority', val: pm.priority },
                { label: 'Interval Miles', val: pm.interval_miles ? `${pm.interval_miles.toLocaleString()} mi` : '—' },
                { label: 'Interval Days', val: pm.interval_days ? `${pm.interval_days} days` : '—' },
                { label: 'Last Completed', val: pm.last_completed_date ? new Date(pm.last_completed_date).toLocaleDateString() : '—' },
                { label: 'Last Miles', val: pm.last_completed_miles ? pm.last_completed_miles.toLocaleString() : '—' },
              ].map(r => (
                <div key={r.label}><div style={S.label}>{r.label}</div><div style={{ fontSize: 13, color: 'var(--tz-text)', marginTop: 4 }}>{r.val}</div></div>
              ))}
            </div>
            {pm.notes && <div style={{ marginTop: 12 }}><div style={S.label}>Notes</div><div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{pm.notes}</div></div>}
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 12 }}>Completion History</div>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--tz-textTertiary)', fontSize: 12 }}>No completions recorded yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Date', 'Miles', 'Notes'].map(h => <th key={h} style={{ fontFamily: MONO, fontSize: 8, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', padding: '6px 8px', textAlign: 'left', background: 'var(--tz-bgInput)' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td style={{ padding: '8px', fontSize: 12, color: 'var(--tz-text)' }}>{new Date(h.completed_date).toLocaleDateString()}</td>
                      <td style={{ padding: '8px', fontSize: 12, fontFamily: MONO, color: MUTED }}>{h.completed_miles?.toLocaleString() || '—'}</td>
                      <td style={{ padding: '8px', fontSize: 11, color: MUTED }}>{h.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 12 }}>Vehicle</div>
          {[
            { label: 'Unit #', val: `#${asset.unit_number}` },
            { label: 'Year', val: asset.year },
            { label: 'Make', val: asset.make },
            { label: 'Model', val: asset.model },
            { label: 'Odometer', val: asset.odometer ? `${asset.odometer.toLocaleString()} mi` : '—' },
          ].filter(r => r.val).map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 12 }}>
              <span style={{ color: 'var(--tz-textTertiary)' }}>{r.label}</span><span style={{ color: 'var(--tz-text)' }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
