'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'
const priColor: Record<string, string> = { low: MUTED, medium: BLUE, high: AMBER, critical: RED }
const stColor: Record<string, string> = { open: BLUE, in_progress: AMBER, resolved: GREEN, closed: MUTED }
const STATUS_FLOW = ['open', 'in_progress', 'resolved', 'closed']

export default function IssueDetailPage() {
  const { tokens: th } = useTheme()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [issue, setIssue] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'overview' | 'activity'>('overview')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const [{ data: i }, { data: a }] = await Promise.all([
        supabase.from('maint_issues').select('*, assets(unit_number, year, make, model), maint_drivers(full_name)').eq('id', params.id).single(),
        supabase.from('maint_activity_log').select('*').eq('entity_type', 'issue').eq('entity_id', params.id).order('created_at', { ascending: false }).limit(50),
      ])
      if (!i) { router.push('/maintenance/issues'); return }
      setIssue(i)
      setActivities(a || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function updateStatus(status: string) {
    setSaving(true)
    const updates: any = { status }
    if (status === 'resolved') updates.resolved_date = new Date().toISOString()
    await fetch('/api/maintenance/crud', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'maint_issues', id: params.id, ...updates }) })
    setIssue((i: any) => ({ ...i, ...updates }))
    setSaving(false)
  }

  if (loading) return <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const asset = issue.assets || {}
  const driver = issue.maint_drivers || {}
  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(issue.status) + 1]
  const S: Record<string, React.CSSProperties> = {
    card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tz-textTertiary)' },
  }

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)' }}>{issue.issue_number || 'Issue'}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tz-text)', marginTop: 4 }}>{issue.title}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>#{asset.unit_number || '—'} {asset.make} {asset.model} · Reported by {driver.full_name || '—'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, fontWeight: 700, background: `${priColor[issue.priority] || MUTED}18`, color: priColor[issue.priority] || MUTED, textTransform: 'uppercase' }}>{issue.priority}</span>
          <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, fontWeight: 700, background: `${stColor[issue.status] || MUTED}18`, color: stColor[issue.status] || MUTED, textTransform: 'uppercase' }}>{issue.status?.replace(/_/g, ' ')}</span>
          {nextStatus && <button onClick={() => updateStatus(nextStatus)} disabled={saving} style={{ padding: '6px 14px', background: 'var(--tz-accent)', border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>{saving ? '...' : `Mark ${nextStatus.replace(/_/g, ' ')}`}</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${'var(--tz-border)'}` }}>
        {(['overview', 'activity'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent', color: tab === t ? 'var(--tz-text)' : MUTED, fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
          <div style={S.card}>
            <div style={{ marginBottom: 12 }}><div style={S.label}>Description</div><div style={{ fontSize: 13, color: 'var(--tz-text)', marginTop: 4 }}>{issue.description || 'No description'}</div></div>
            {issue.resolution_notes && <div><div style={S.label}>Resolution</div><div style={{ fontSize: 13, color: GREEN, marginTop: 4 }}>{issue.resolution_notes}</div></div>}
          </div>
          <div style={S.card}>
            {[
              { label: 'Category', val: issue.category?.replace(/_/g, ' ') },
              { label: 'Due Date', val: issue.due_date ? new Date(issue.due_date).toLocaleDateString() : '—' },
              { label: 'Created', val: new Date(issue.created_at).toLocaleDateString() },
              { label: 'Resolved', val: issue.resolved_date ? new Date(issue.resolved_date).toLocaleDateString() : '—' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 12 }}>
                <span style={{ color: 'var(--tz-textTertiary)' }}>{r.label}</span><span style={{ color: 'var(--tz-text)', textTransform: 'capitalize' }}>{r.val || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div style={S.card}>
          {activities.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--tz-textTertiary)', fontSize: 12 }}>No activity yet</div> : activities.map(a => (
            <div key={a.id} style={{ padding: '10px 0', borderBottom: `1px solid ${'var(--tz-border)'}` }}>
              <div style={{ fontSize: 12, color: 'var(--tz-text)' }}><span style={{ fontWeight: 600 }}>{a.user_name || 'System'}</span> · <span style={{ color: MUTED }}>{a.activity_type}</span></div>
              <div style={{ fontSize: 12, color: 'var(--tz-text)', marginTop: 2 }}>{a.message}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{new Date(a.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
