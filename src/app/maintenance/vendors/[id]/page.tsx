'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', MUTED = 'var(--tz-textSecondary)'

export default function VendorDetailPage() {
  const { tokens: th } = useTheme()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [vendor, setVendor] = useState<any>(null)
  const [repairs, setRepairs] = useState<any[]>([])
  const [tab, setTab] = useState<'profile' | 'repairs'>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const [{ data: v }, { data: r }] = await Promise.all([
        supabase.from('maint_vendors').select('*').eq('id', params.id).single(),
        supabase.from('maint_road_repairs').select('id, repair_number, description, status, total_cost, reported_date, assets(unit_number)').eq('vendor_id', params.id).order('reported_date', { ascending: false }).limit(50),
      ])
      if (!v) { router.push('/maintenance/vendors'); return }
      setVendor(v)
      setRepairs(r || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function saveField(field: string, value: any) {
    setSaving(true)
    await fetch('/api/maintenance/crud', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_vendors', id: params.id, [field]: value }),
    })
    setVendor((v: any) => ({ ...v, [field]: value }))
    setSaving(false)
  }

  if (loading) return <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const S: Record<string, React.CSSProperties> = {
    card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tz-textTertiary)', marginBottom: 4, display: 'block' },
    input: { width: '100%', padding: '8px 11px', background: 'var(--tz-inputBg)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 7, fontSize: 12, color: 'var(--tz-text)', outline: 'none', fontFamily: 'inherit', minHeight: 36, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  }

  const stColor: Record<string, string> = { open: BLUE, in_progress: AMBER, completed: GREEN, invoiced: MUTED }
  const totalSpend = repairs.reduce((s, r) => s + (r.total_cost || 0), 0)

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)' }}>{vendor.name}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{[vendor.city, vendor.state].filter(Boolean).join(', ')} · {repairs.length} repairs · ${totalSpend.toFixed(0)} total</div>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, fontWeight: 700, background: vendor.active ? `${GREEN}18` : `${MUTED}18`, color: vendor.active ? GREEN : MUTED }}>
          {vendor.active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${'var(--tz-border)'}` }}>
        {(['profile', 'repairs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent',
            color: tab === t ? 'var(--tz-text)' : MUTED, fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize',
          }}>{t === 'repairs' ? 'Repair History' : t}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={S.card}>
          <div style={S.row2}>
            <div><label style={S.label}>Name</label><input style={S.input} defaultValue={vendor.name} onBlur={e => saveField('name', e.target.value)} /></div>
            <div><label style={S.label}>Contact</label><input style={S.input} defaultValue={vendor.contact_person || ''} onBlur={e => saveField('contact_person', e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Address</label><input style={S.input} defaultValue={vendor.address || ''} onBlur={e => saveField('address', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={S.label}>City</label><input style={S.input} defaultValue={vendor.city || ''} onBlur={e => saveField('city', e.target.value)} /></div>
            <div><label style={S.label}>State</label><input style={S.input} defaultValue={vendor.state || ''} onBlur={e => saveField('state', e.target.value)} /></div>
            <div><label style={S.label}>Zip</label><input style={S.input} defaultValue={vendor.zip || ''} onBlur={e => saveField('zip', e.target.value)} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Phone</label><input style={S.input} defaultValue={vendor.phone || ''} onBlur={e => saveField('phone', e.target.value)} /></div>
            <div><label style={S.label}>Email</label><input style={S.input} defaultValue={vendor.email || ''} onBlur={e => saveField('email', e.target.value)} /></div>
          </div>
          {vendor.specialties && Array.isArray(vendor.specialties) && vendor.specialties.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <label style={S.label}>Specialties</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {vendor.specialties.map((s: string) => (
                  <span key={s} style={{ padding: '3px 10px', borderRadius: 100, fontSize: 10, background: 'rgba(29,111,232,.1)', color: 'var(--tz-accentLight)', border: '1px solid rgba(29,111,232,.2)', textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 10 }}><label style={S.label}>Pricing Notes</label><textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' as const }} defaultValue={vendor.pricing_notes || ''} onBlur={e => saveField('pricing_notes', e.target.value)} /></div>
          {saving && <div style={{ fontSize: 10, color: BLUE, marginTop: 6 }}>Saving...</div>}
        </div>
      )}

      {tab === 'repairs' && (
        <div style={S.card}>
          {repairs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--tz-textTertiary)', fontSize: 12 }}>No repair history with this vendor</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Repair #', 'Truck', 'Description', 'Status', 'Cost', 'Date'].map(h => (
                  <th key={h} style={{ fontFamily: MONO, fontSize: 8, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', padding: '6px 8px', textAlign: 'left', background: 'var(--tz-bgInput)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {repairs.map(r => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/maintenance/repairs/${r.id}`}>
                    <td style={{ padding: 8, fontSize: 11, fontFamily: MONO, color: BLUE, fontWeight: 700 }}>{r.repair_number || '—'}</td>
                    <td style={{ padding: 8, fontSize: 11 }}>#{(r.assets as any)?.unit_number || '—'}</td>
                    <td style={{ padding: 8, fontSize: 11, color: MUTED, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description?.slice(0, 40) || '—'}</td>
                    <td style={{ padding: 8 }}><span style={{ fontSize: 9, fontWeight: 600, color: stColor[r.status] || MUTED, background: `${stColor[r.status] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.status?.replace(/_/g, ' ')}</span></td>
                    <td style={{ padding: 8, fontSize: 11, fontFamily: MONO }}>${(r.total_cost || 0).toFixed(0)}</td>
                    <td style={{ padding: 8, fontSize: 11, color: MUTED }}>{r.reported_date ? new Date(r.reported_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
