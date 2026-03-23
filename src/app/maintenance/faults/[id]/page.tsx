'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'
const sevColor: Record<string, string> = { info: BLUE, warning: AMBER, critical: RED }

export default function FaultDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [fault, setFault] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resolveNotes, setResolveNotes] = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const { data } = await supabase.from('maint_faults').select('*, assets(unit_number, year, make, model)').eq('id', params.id).single()
      if (!data) { router.push('/maintenance/faults'); return }
      setFault(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  async function resolve() {
    setSaving(true)
    await fetch('/api/maintenance/crud', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'maint_faults', id: params.id, resolved: true, resolved_date: new Date().toISOString(), resolved_notes: resolveNotes }) })
    setFault((f: any) => ({ ...f, resolved: true, resolved_date: new Date().toISOString() }))
    setSaving(false)
  }

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>
  const asset = fault.assets || {}
  const S: Record<string, React.CSSProperties> = { card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 16, marginBottom: 12 }, label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#48536A' } }

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>{fault.fault_code}</div>
          <div style={{ fontSize: 13, color: MUTED }}>#{asset.unit_number || '—'} {asset.make} {asset.model}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, fontWeight: 700, background: `${sevColor[fault.severity] || MUTED}18`, color: sevColor[fault.severity] || MUTED, textTransform: 'uppercase' }}>{fault.severity}</span>
          <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, fontWeight: 700, background: fault.resolved ? `${GREEN}18` : `${RED}18`, color: fault.resolved ? GREEN : RED }}>{fault.resolved ? 'RESOLVED' : 'OPEN'}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
        <div>
          <div style={S.card}>
            <div style={S.label}>Description</div>
            <div style={{ fontSize: 13, color: '#DDE3EE', marginTop: 4 }}>{fault.fault_description || 'No description'}</div>
          </div>
          {!fault.resolved && (
            <div style={{ ...S.card, border: `1px solid ${GREEN}33` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 10 }}>Resolve Fault</div>
              <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Resolution notes..." style={{ width: '100%', padding: '8px 10px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', fontFamily: FONT, minHeight: 48, resize: 'vertical' as const, boxSizing: 'border-box', marginBottom: 8 }} />
              <button onClick={resolve} disabled={saving} style={{ padding: '8px 16px', background: GREEN, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>{saving ? 'Saving...' : 'Mark Resolved'}</button>
            </div>
          )}
        </div>
        <div style={S.card}>
          {[
            { label: 'Source', val: fault.source_system },
            { label: 'First Seen', val: fault.first_seen ? new Date(fault.first_seen).toLocaleString() : '—' },
            { label: 'Last Seen', val: fault.last_seen ? new Date(fault.last_seen).toLocaleString() : '—' },
            { label: 'Occurrences', val: fault.occurrence_count },
            { label: 'Resolved', val: fault.resolved_date ? new Date(fault.resolved_date).toLocaleString() : '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 12 }}>
              <span style={{ color: '#48536A' }}>{r.label}</span><span style={{ color: '#DDE3EE' }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
