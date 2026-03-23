'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const CATEGORIES = ['engine', 'electrical', 'brakes', 'tires', 'body', 'trailer', 'other']

export default function NewIssuePage() {
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ asset_id: '', reported_by: '', title: '', description: '', priority: 'medium', category: '', due_date: '', notes: '' })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const [a, d] = await Promise.all([
        supabase.from('assets').select('id, unit_number, year, make, model').eq('shop_id', p.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number'),
        supabase.from('maint_drivers').select('id, full_name').eq('shop_id', p.shop_id).eq('active', true).order('full_name'),
      ])
      setAssets(a.data || [])
      setDrivers(d.data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title) { setError('Title required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_issues', shop_id: shopId, asset_id: form.asset_id || null,
        reported_by: form.reported_by || null, title: form.title, description: form.description || null,
        priority: form.priority, category: form.category || null, due_date: form.due_date || null, status: 'open',
      }),
    })
    if (!res.ok) { setError('Failed to create'); setSaving(false); return }
    const issue = await res.json()
    router.push(`/maintenance/issues/${issue.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24, maxWidth: 640, margin: '0 auto' },
    card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#48536A', marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 20 }}>Report Issue</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Title *</label><input style={S.input} value={form.title} onChange={set('title')} placeholder="Brief description of the issue" /></div>
          <div style={S.row2}>
            <div><label style={S.label}>Truck</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={set('asset_id')}><option value="">Select...</option>{assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make}</option>)}</select></div>
            <div><label style={S.label}>Reported By</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.reported_by} onChange={set('reported_by')}><option value="">Select...</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Priority</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.priority} onChange={set('priority')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
            <div><label style={S.label}>Category</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.category} onChange={set('category')}><option value="">Select...</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Due Date</label><input style={S.input} type="date" value={form.due_date} onChange={set('due_date')} /></div>
          <div><label style={S.label}>Description</label><textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' as const }} value={form.description} onChange={set('description')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Report Issue'}</button>
      </form>
    </div>
  )
}
