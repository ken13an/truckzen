'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const GREEN = '#1DB870', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function RecallDetailPage() {
  const { tokens: t } = useTheme()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [recall, setRecall] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const { data } = await supabase.from('maint_recalls').select('*, assets(unit_number, year, make, model)').eq('id', params.id).single()
      if (!data) { router.push('/maintenance/recalls'); return }
      setRecall(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  async function markComplete() {
    setSaving(true)
    await fetch('/api/maintenance/crud', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'maint_recalls', id: params.id, status: 'completed', completed_date: new Date().toISOString() }) })
    setRecall((r: any) => ({ ...r, status: 'completed', completed_date: new Date().toISOString() }))
    setSaving(false)
  }

  if (loading) return <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>
  const asset = recall.assets || {}
  const S: Record<string, React.CSSProperties> = { card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16, marginBottom: 12 }, label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tz-textTertiary)' } }

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)' }}>{recall.title}</div>
          <div style={{ fontSize: 13, color: MUTED }}>#{asset.unit_number || '—'} {asset.make} {asset.model} · {recall.manufacturer || '—'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, fontWeight: 700, background: recall.status === 'completed' ? `${GREEN}18` : `${RED}18`, color: recall.status === 'completed' ? GREEN : RED, textTransform: 'uppercase' }}>{recall.status}</span>
          {recall.status !== 'completed' && <button onClick={markComplete} disabled={saving} style={{ padding: '6px 14px', background: GREEN, border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>{saving ? '...' : 'Mark Completed'}</button>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
        <div>
          <div style={S.card}><div style={S.label}>Description</div><div style={{ fontSize: 13, color: 'var(--tz-text)', marginTop: 4 }}>{recall.description || 'No description'}</div></div>
          {recall.remedy && <div style={S.card}><div style={S.label}>Remedy</div><div style={{ fontSize: 13, color: 'var(--tz-text)', marginTop: 4 }}>{recall.remedy}</div></div>}
        </div>
        <div style={S.card}>
          {[
            { label: 'Recall #', val: recall.recall_number },
            { label: 'NHTSA ID', val: recall.nhtsa_id },
            { label: 'Manufacturer', val: recall.manufacturer },
            { label: 'Created', val: new Date(recall.created_at).toLocaleDateString() },
            { label: 'Completed', val: recall.completed_date ? new Date(recall.completed_date).toLocaleDateString() : '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 12 }}>
              <span style={{ color: 'var(--tz-textTertiary)' }}>{r.label}</span><span style={{ color: 'var(--tz-text)' }}>{r.val || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
