'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Upload } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

function expiryStatus(d: string | null) {
  if (!d) return { color: MUTED, label: 'Not set' }
  const days = Math.floor((new Date(d).getTime() - Date.now()) / 86400000)
  if (days < 0) return { color: RED, label: `Expired ${Math.abs(days)}d ago` }
  if (days < 30) return { color: RED, label: `${days}d left` }
  if (days < 60) return { color: AMBER, label: `${days}d left` }
  return { color: GREEN, label: `${days}d left` }
}

export default function DriverDetailPage() {
  const { tokens: th } = useTheme()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [driver, setDriver] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [tab, setTab] = useState<'profile' | 'compliance' | 'assignments' | 'documents'>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shopId, setShopId] = useState('')
  const [assignAsset, setAssignAsset] = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setShopId(profile.shop_id)
      const [{ data: d }, { data: a }, { data: docs }, { data: allAssets }] = await Promise.all([
        supabase.from('maint_drivers').select('*').eq('id', params.id).single(),
        supabase.from('maint_driver_assignments').select('*, assets(unit_number, year, make, model)').eq('driver_id', params.id).order('assigned_date', { ascending: false }),
        supabase.from('maint_driver_documents').select('*').eq('driver_id', params.id).order('created_at', { ascending: false }),
        supabase.from('assets').select('id, unit_number, year, make, model').eq('shop_id', profile.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number'),
      ])
      if (!d) { router.push('/maintenance/drivers'); return }
      setDriver(d)
      setAssignments(a || [])
      setDocuments(docs || [])
      setAssets(allAssets || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function saveField(field: string, value: any) {
    setSaving(true)
    await fetch('/api/maintenance/crud', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_drivers', id: params.id, [field]: value }),
    })
    setDriver((d: any) => ({ ...d, [field]: value }))
    setSaving(false)
  }

  async function assignTruck() {
    if (!assignAsset) return
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_driver_assignments', shop_id: shopId, driver_id: params.id, asset_id: assignAsset, assigned_date: new Date().toISOString().split('T')[0] }),
    })
    if (res.ok) {
      const a = await res.json()
      const asset = assets.find(x => x.id === assignAsset)
      setAssignments(prev => [{ ...a, assets: asset }, ...prev])
      setAssignAsset('')
    }
  }

  if (loading) return <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const S: Record<string, React.CSSProperties> = {
    card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tz-textTertiary)', marginBottom: 4, display: 'block' },
    input: { width: '100%', padding: '8px 11px', background: 'var(--tz-inputBg)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 7, fontSize: 12, color: 'var(--tz-text)', outline: 'none', fontFamily: 'inherit', minHeight: 36, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  }

  const tabs = ['profile', 'compliance', 'assignments', 'documents'] as const
  const currentAssignment = assignments.find(a => !a.unassigned_date)

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)' }}>{driver.full_name}</div>
          <div style={{ fontSize: 12, color: MUTED }}>
            CDL {driver.cdl_class || 'A'} · {driver.cdl_number || 'No CDL'} · {currentAssignment ? `Truck #${currentAssignment.assets?.unit_number}` : 'Unassigned'}
          </div>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, fontWeight: 700, background: driver.active ? `${GREEN}18` : `${MUTED}18`, color: driver.active ? GREEN : MUTED }}>
          {driver.active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${'var(--tz-border)'}` }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent',
            color: tab === t ? 'var(--tz-text)' : MUTED, fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 12 }}>Driver Profile</div>
          <div style={S.row2}>
            <div><label style={S.label}>Full Name</label><input style={S.input} defaultValue={driver.full_name} onBlur={e => saveField('full_name', e.target.value)} /></div>
            <div><label style={S.label}>Phone</label><input style={S.input} defaultValue={driver.phone || ''} onBlur={e => saveField('phone', e.target.value)} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Email</label><input style={S.input} defaultValue={driver.email || ''} onBlur={e => saveField('email', e.target.value)} /></div>
            <div><label style={S.label}>Hire Date</label><input style={S.input} type="date" defaultValue={driver.hire_date || ''} onBlur={e => saveField('hire_date', e.target.value || null)} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>CDL Number</label><input style={S.input} defaultValue={driver.cdl_number || ''} onBlur={e => saveField('cdl_number', e.target.value)} /></div>
            <div><label style={S.label}>CDL Class</label>
              <select style={{ ...S.input, appearance: 'none' as const }} defaultValue={driver.cdl_class || 'A'} onChange={e => saveField('cdl_class', e.target.value)}>
                <option value="A">A</option><option value="B">B</option><option value="C">C</option>
              </select>
            </div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>CDL State</label><input style={S.input} defaultValue={driver.cdl_state || ''} onBlur={e => saveField('cdl_state', e.target.value)} /></div>
            <div><label style={S.label}>CDL Expiry</label><input style={S.input} type="date" defaultValue={driver.cdl_expiry || ''} onBlur={e => saveField('cdl_expiry', e.target.value || null)} /></div>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' as const }} defaultValue={driver.notes || ''} onBlur={e => saveField('notes', e.target.value)} /></div>
          {saving && <div style={{ fontSize: 10, color: BLUE, marginTop: 6 }}>Saving...</div>}
        </div>
      )}

      {tab === 'compliance' && (
        <div>
          {[
            { title: 'CDL License', expiry: driver.cdl_expiry, details: `${driver.cdl_class || 'A'} · ${driver.cdl_state || '—'} · ${driver.cdl_number || '—'}` },
            { title: 'Medical Card', expiry: driver.medical_card_expiry, details: driver.medical_card_provider || '—' },
            { title: 'Drug Test', expiry: driver.next_drug_test_due, details: `Last: ${driver.last_drug_test ? new Date(driver.last_drug_test).toLocaleDateString() : '—'} · Result: ${driver.drug_test_result || '—'}` },
            { title: 'MVR Check', expiry: null, details: `Last: ${driver.last_mvr_date ? new Date(driver.last_mvr_date).toLocaleDateString() : '—'} · Status: ${driver.mvr_status || '—'}` },
          ].map(item => {
            const st = expiryStatus(item.expiry)
            return (
              <div key={item.title} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{item.details}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {item.expiry && <div style={{ fontSize: 12, fontFamily: MONO, color: st.color }}>{new Date(item.expiry).toLocaleDateString()}</div>}
                  <div style={{ fontSize: 10, color: st.color, fontWeight: 700, marginTop: 2 }}>{st.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'assignments' && (
        <div>
          <div style={{ ...S.card, display: 'flex', gap: 8, alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Assign Truck</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={assignAsset} onChange={e => setAssignAsset(e.target.value)}>
                <option value="">Select truck...</option>
                {assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make} {a.model}</option>)}
              </select>
            </div>
            <button onClick={assignTruck} style={{ padding: '8px 16px', background: 'var(--tz-accent)', border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, minHeight: 36 }}>Assign</button>
          </div>
          {assignments.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', color: 'var(--tz-textTertiary)', fontSize: 12 }}>No assignments yet</div>
          ) : assignments.map(a => (
            <div key={a.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--tz-text)' }}>#{a.assets?.unit_number || '—'}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{[a.assets?.year, a.assets?.make, a.assets?.model].filter(Boolean).join(' ')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: MUTED }}>Assigned: {new Date(a.assigned_date).toLocaleDateString()}</div>
                {a.unassigned_date ? (
                  <div style={{ fontSize: 11, color: MUTED }}>Unassigned: {new Date(a.unassigned_date).toLocaleDateString()}</div>
                ) : (
                  <span style={{ fontSize: 9, fontWeight: 700, color: GREEN, background: `${GREEN}18`, padding: '2px 6px', borderRadius: 4 }}>CURRENT</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'documents' && (
        <div>
          <div style={{ ...S.card, textAlign: 'center', padding: 30, border: `2px dashed ${'var(--tz-border)'}` }}>
            <Upload size={24} color={'var(--tz-textTertiary)'} style={{ marginBottom: 8 }} />
            <div style={{ color: 'var(--tz-textTertiary)', fontSize: 12 }}>Upload CDL, medical card, drug test results, MVR report</div>
          </div>
          {documents.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', color: 'var(--tz-textTertiary)', fontSize: 12 }}>No documents uploaded yet</div>
          ) : documents.map(doc => (
            <div key={doc.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tz-text)', textTransform: 'capitalize' }}>{doc.doc_type?.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{doc.file_name || 'Document'}</div>
              </div>
              <div style={{ fontSize: 11, color: MUTED }}>{doc.expiry_date ? `Expires: ${new Date(doc.expiry_date).toLocaleDateString()}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
