'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const GREEN = '#1DB870', RED = '#D94F4F', AMBER = '#D4882A', MUTED = '#7C8BA0'

interface ChecklistItem { name: string; required: boolean; type: string }
interface Category { category: string; items: ChecklistItem[] }
interface ItemResponse { pass: boolean | null; notes: string }

export default function NewInspectionPage() {
  const { tokens: th } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ template_id: '', asset_id: '', driver_id: '', odometer: '' })
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [responses, setResponses] = useState<Record<string, ItemResponse>>({})
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  const [overallNotes, setOverallNotes] = useState('')

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const [t, a, d] = await Promise.all([
        supabase.from('maint_inspection_templates').select('*').eq('shop_id', p.shop_id).eq('active', true),
        supabase.from('assets').select('id, unit_number, year, make, model').eq('shop_id', p.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number'),
        supabase.from('maint_drivers').select('id, full_name').eq('shop_id', p.shop_id).eq('active', true).order('full_name'),
      ])
      setTemplates(t.data || [])
      setAssets(a.data || [])
      setDrivers(d.data || [])
    })
  }, [])

  function selectTemplate(id: string) {
    const tpl = templates.find(t => t.id === id)
    setForm(f => ({ ...f, template_id: id }))
    setSelectedTemplate(tpl)
    if (tpl?.checklist) {
      const cats = tpl.checklist as Category[]
      const r: Record<string, ItemResponse> = {}
      const exp: Record<string, boolean> = {}
      cats.forEach(cat => {
        exp[cat.category] = true
        cat.items.forEach(item => { r[`${cat.category}::${item.name}`] = { pass: null, notes: '' } })
      })
      setResponses(r)
      setExpandedCats(exp)
    }
  }

  function setItemResult(key: string, pass: boolean) {
    setResponses(r => ({ ...r, [key]: { ...r[key], pass } }))
  }

  function setItemNotes(key: string, notes: string) {
    setResponses(r => ({ ...r, [key]: { ...r[key], notes } }))
  }

  const allAnswered = Object.values(responses).every(r => r.pass !== null)
  const hasFails = Object.values(responses).some(r => r.pass === false)
  const failCount = Object.values(responses).filter(r => r.pass === false).length
  const overallResult = hasFails ? 'fail' : 'pass'

  async function submit() {
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_inspections', shop_id: shopId,
        template_id: form.template_id || null, asset_id: form.asset_id || null,
        driver_id: form.driver_id || null, type: selectedTemplate?.type || 'general',
        odometer: form.odometer ? parseInt(form.odometer) : null,
        responses: Object.entries(responses).map(([key, val]) => {
          const [category, name] = key.split('::')
          return { category, name, pass: val.pass, notes: val.notes }
        }),
        overall_result: overallResult, status: 'submitted',
        notes: overallNotes || null, inspection_date: new Date().toISOString(),
      }),
    })
    if (!res.ok) { setError('Failed to create inspection'); setSaving(false); return }
    const inspection = await res.json()

    // Create defects for failed items
    for (const [key, val] of Object.entries(responses)) {
      if (val.pass === false) {
        const [category, name] = key.split('::')
        await fetch('/api/maintenance/crud', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'maint_inspection_defects', shop_id: shopId,
            inspection_id: inspection.id, asset_id: form.asset_id || null,
            category, item_name: name, severity: 'minor',
            description: val.notes || `${name} failed inspection`, resolved: false,
          }),
        })
      }
    }

    router.push(`/maintenance/inspections/${inspection.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: th.bg, minHeight: '100vh', color: th.text, fontFamily: FONT, padding: 24, maxWidth: 720, margin: '0 auto' },
    card: { background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: th.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 12, color: th.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    btn: { padding: '12px 24px', background: th.accent, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: th.bgLight, cursor: 'pointer', fontFamily: 'inherit' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: RED, marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: th.text, marginBottom: 4 }}>New Inspection</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>Step {step} of 3</div>
      {error && <div style={S.error}>{error}</div>}

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? th.accent : th.border }} />
        ))}
      </div>

      {step === 1 && (
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: th.text, marginBottom: 12 }}>Select Template & Vehicle</div>
          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>Inspection Template *</label>
            <select style={{ ...S.input, appearance: 'none' as const }} value={form.template_id} onChange={e => selectTemplate(e.target.value)}>
              <option value="">Select template...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={S.label}>Truck</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))}>
                <option value="">Select truck...</option>
                {assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Driver</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}>
                <option value="">Select driver...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
          </div>
          <div><label style={S.label}>Odometer</label><input style={S.input} type="number" value={form.odometer} onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))} placeholder="Current mileage" /></div>
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button onClick={() => { if (form.template_id) setStep(2); else setError('Select a template') }} style={S.btn}>Next: Checklist</button>
          </div>
        </div>
      )}

      {step === 2 && selectedTemplate && (
        <div>
          {(selectedTemplate.checklist as Category[]).map(cat => (
            <div key={cat.category} style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              <div onClick={() => setExpandedCats(e => ({ ...e, [cat.category]: !e[cat.category] }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: 'pointer', background: th.border }}>
                {expandedCats[cat.category] ? <ChevronDown size={14} color={MUTED} /> : <ChevronRight size={14} color={MUTED} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: th.text, flex: 1 }}>{cat.category}</span>
                <span style={{ fontSize: 10, color: MUTED }}>{cat.items.length} items</span>
              </div>
              {expandedCats[cat.category] && cat.items.map(item => {
                const key = `${cat.category}::${item.name}`
                const resp = responses[key]
                return (
                  <div key={key} style={{ padding: '10px 16px', borderTop: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: th.text }}>{item.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setItemResult(key, true)} style={{ padding: '4px 12px', borderRadius: 6, border: resp?.pass === true ? `1px solid ${GREEN}` : `1px solid ${th.border}`, background: resp?.pass === true ? `${GREEN}18` : 'transparent', color: resp?.pass === true ? GREEN : MUTED, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>PASS</button>
                      <button onClick={() => setItemResult(key, false)} style={{ padding: '4px 12px', borderRadius: 6, border: resp?.pass === false ? `1px solid ${RED}` : `1px solid ${th.border}`, background: resp?.pass === false ? `${RED}18` : 'transparent', color: resp?.pass === false ? RED : MUTED, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>FAIL</button>
                    </div>
                    {resp?.pass === false && (
                      <input style={{ ...S.input, maxWidth: 200, minHeight: 30, padding: '4px 8px', fontSize: 11 }} value={resp.notes} onChange={e => setItemNotes(key, e.target.value)} placeholder="Describe issue..." />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)} style={{ ...S.btn, background: th.border }}>Back</button>
            <button onClick={() => setStep(3)} style={S.btn}>Next: Review</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          {hasFails && (
            <div style={{ ...S.card, borderColor: `${RED}44`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color={RED} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>{failCount} defect{failCount > 1 ? 's' : ''} found</div>
                <div style={{ fontSize: 11, color: MUTED }}>Defect records will be created automatically.</div>
              </div>
            </div>
          )}

          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: th.text }}>Overall Result</div>
              <span style={{ padding: '4px 14px', borderRadius: 100, fontFamily: MONO, fontSize: 11, fontWeight: 700, background: overallResult === 'pass' ? `${GREEN}18` : `${RED}18`, color: overallResult === 'pass' ? GREEN : RED }}>
                {overallResult.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
              {Object.values(responses).filter(r => r.pass === true).length} passed, {failCount} failed, {Object.values(responses).filter(r => r.pass === null).length} unanswered
            </div>
            <label style={S.label}>Additional Notes</label>
            <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' as const }} value={overallNotes} onChange={e => setOverallNotes(e.target.value)} placeholder="Any additional notes..." />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button onClick={() => setStep(2)} style={{ ...S.btn, background: th.border }}>Back</button>
            <button onClick={submit} disabled={saving} style={S.btn}>{saving ? 'Submitting...' : 'Submit Inspection'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
