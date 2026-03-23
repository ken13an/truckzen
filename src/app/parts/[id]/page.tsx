'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans', sans-serif"
const MONO = "'IBM Plex Mono', monospace"
const BLUE = '#1B6EE6'
const PAGE_BG = '#F4F5F7'

export default function PartDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [part, setPart] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setUser(profile)
      const res = await fetch(`/api/parts/${params.id}`)
      if (!res.ok) { router.push('/parts'); return }
      const data = await res.json()
      setPart(data)
      setForm(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/parts/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const updated = await res.json()
      setPart(updated)
      setForm(updated)
      setEditing(false)
      flash('Part saved successfully')
    } else {
      flash('Failed to save')
    }
    setSaving(false)
  }

  function handleCancel() {
    setForm(part)
    setEditing(false)
  }

  const canEdit = ['owner', 'gm', 'it_person', 'shop_manager', 'parts_manager', 'office_admin'].includes(user?.role)

  const fmt = (n: number | null | undefined) => n != null ? '$' + Number(n).toFixed(2) : '--'
  const fmtQty = (n: number | null | undefined) => n != null ? Number(n).toFixed(2) : '--'
  const fmtPct = (n: number | null | undefined) => n != null ? Number(n).toFixed(2) + '%' : '--'

  function getStatus() { return part?.status || 'active' }
  function getOnHand() { return part?.on_hand ?? 0 }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: FONT, padding: 48, textAlign: 'center', color: '#9CA3AF' }}>
        Loading...
      </div>
    )
  }

  const status = getStatus()
  const onHand = getOnHand()
  const crossRefs = part?.cross_references || []

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: FONT, padding: 24 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: BLUE, color: '#fff', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ fontFamily: MONO, fontSize: 13, color: BLUE, fontWeight: 600 }}>{part.part_number || 'No Part #'}</div>
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 100, fontSize: 10, fontWeight: 600,
              background: status === 'active' ? '#F0FDF4' : '#F3F4F6',
              color: status === 'active' ? '#16A34A' : '#9CA3AF',
            }}>
              {status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A' }}>{part.description || 'Untitled Part'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/parts" style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff',
            color: '#374151', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit',
          }}>Back to Parts</a>
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', background: BLUE,
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Edit</button>
          )}
          {editing && (
            <>
              <button onClick={handleCancel} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff',
                color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', background: BLUE,
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Saving...' : 'Save'}</button>
            </>
          )}
        </div>
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* General section */}
            <div style={cardStyle}>
              <div style={sectionTitle}>General</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Status" value={editing ? undefined : (status === 'active' ? 'Active' : 'Inactive')}>
                  {editing && (
                    <select value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  )}
                </Field>
                <Field label="Track Quantity" value={editing ? undefined : (part.track_quantity !== false ? 'Yes' : 'No')}>
                  {editing && (
                    <select value={form.track_quantity !== false ? 'true' : 'false'} onChange={e => setForm({ ...form, track_quantity: e.target.value === 'true' })} style={inputStyle}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  )}
                </Field>
                <Field label="Manufacturer" value={editing ? undefined : (part.manufacturer || '--')}>
                  {editing && <input value={form.manufacturer || ''} onChange={e => setForm({ ...form, manufacturer: e.target.value })} style={inputStyle} />}
                </Field>
                <Field label="UOM" value={editing ? undefined : (part.uom || '--')}>
                  {editing && <input value={form.uom || ''} onChange={e => setForm({ ...form, uom: e.target.value })} style={inputStyle} />}
                </Field>
                <Field label="Part Category" value={editing ? undefined : (part.part_category || part.category || '--')}>
                  {editing && <input value={form.part_category || form.category || ''} onChange={e => setForm({ ...form, part_category: e.target.value })} style={inputStyle} />}
                </Field>
                <Field label="Item Type" value={editing ? undefined : (part.item_type || '--')}>
                  {editing && <input value={form.item_type || ''} onChange={e => setForm({ ...form, item_type: e.target.value })} style={inputStyle} />}
                </Field>
              </div>
              <div style={{ marginTop: 14 }}>
                <Field label="Notes" value={editing ? undefined : (part.notes || '--')}>
                  {editing && (
                    <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}
                      rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  )}
                </Field>
              </div>
            </div>

            {/* Cross References */}
            <div style={cardStyle}>
              <div style={sectionTitle}>Cross References</div>
              {Array.isArray(crossRefs) && crossRefs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {crossRefs.map((ref: any, i: number) => (
                    <div key={i} style={{ padding: '8px 12px', background: '#F9FAFB', borderRadius: 6, fontSize: 12, color: '#374151', fontFamily: MONO }}>
                      {typeof ref === 'string' ? ref : (ref.part_number || ref.reference || JSON.stringify(ref))}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#9CA3AF' }}>No cross references</div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Pricing section */}
            <div style={cardStyle}>
              <div style={sectionTitle}>Pricing</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Average Cost" value={editing ? undefined : fmt(part.average_cost ?? part.cost_price)}>
                  {editing && <input type="number" step="0.01" value={form.average_cost ?? form.cost_price ?? ''} onChange={e => setForm({ ...form, average_cost: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="Selling Price" value={editing ? undefined : fmt(part.selling_price ?? part.sell_price)}>
                  {editing && <input type="number" step="0.01" value={form.selling_price ?? form.sell_price ?? ''} onChange={e => setForm({ ...form, selling_price: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="Cost Floor" value={editing ? undefined : fmt(part.cost_floor)}>
                  {editing && <input type="number" step="0.01" value={form.cost_floor ?? ''} onChange={e => setForm({ ...form, cost_floor: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="Markup %" value={editing ? undefined : fmtPct(part.markup_percent)}>
                  {editing && <input type="number" step="0.01" value={form.markup_percent ?? ''} onChange={e => setForm({ ...form, markup_percent: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="Margin %" value={editing ? undefined : fmtPct(part.margin_percent)}>
                  {editing && <input type="number" step="0.01" value={form.margin_percent ?? ''} onChange={e => setForm({ ...form, margin_percent: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="Inventory Balance" value={editing ? undefined : fmt(part.inventory_balance)}>
                  {editing && <input type="number" step="0.01" value={form.inventory_balance ?? ''} onChange={e => setForm({ ...form, inventory_balance: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
              </div>
              {/* Tier pricing */}
              <div style={{ ...sectionTitle, marginTop: 20 }}>Tier Pricing</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <Field label="UGL Company" value={editing ? undefined : fmt(part.price_ugl_company)}>
                  {editing && <input type="number" step="0.01" value={form.price_ugl_company ?? ''} onChange={e => setForm({ ...form, price_ugl_company: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="UGL Owner Operator" value={editing ? undefined : fmt(part.price_ugl_owner_operator)}>
                  {editing && <input type="number" step="0.01" value={form.price_ugl_owner_operator ?? ''} onChange={e => setForm({ ...form, price_ugl_owner_operator: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="Outside Customer" value={editing ? undefined : fmt(part.price_outside)}>
                  {editing && <input type="number" step="0.01" value={form.price_outside ?? ''} onChange={e => setForm({ ...form, price_outside: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
              </div>
            </div>

            {/* Inventory section */}
            <div style={cardStyle}>
              <div style={sectionTitle}>Inventory</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="In Stock" value={editing ? undefined : fmtQty(onHand)} valueColor={onHand > 0 ? BLUE : '#9CA3AF'}>
                  {editing && <input type="number" step="0.01" value={form.on_hand ?? 0} onChange={e => setForm({ ...form, on_hand: parseFloat(e.target.value) || 0 })} style={inputStyle} />}
                </Field>
                <Field label="Allocated" value={editing ? undefined : fmtQty(part.allocated ?? part.reserved_qty ?? 0)}>
                  {editing && <input type="number" step="0.01" value={form.allocated ?? form.reserved_qty ?? 0} onChange={e => setForm({ ...form, allocated: parseFloat(e.target.value) || 0 })} style={inputStyle} />}
                </Field>
                <Field label="In Transit" value={editing ? undefined : fmtQty(part.in_transit)}>
                  {editing && <input type="number" step="0.01" value={form.in_transit ?? ''} onChange={e => setForm({ ...form, in_transit: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="Min Qty" value={editing ? undefined : fmtQty(part.min_qty)}>
                  {editing && <input type="number" step="0.01" value={form.min_qty ?? ''} onChange={e => setForm({ ...form, min_qty: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="Max Qty" value={editing ? undefined : fmtQty(part.max_qty)}>
                  {editing && <input type="number" step="0.01" value={form.max_qty ?? ''} onChange={e => setForm({ ...form, max_qty: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />}
                </Field>
                <Field label="Default Location" value={editing ? undefined : (part.default_location || part.bin_location || '--')}>
                  {editing && <input value={form.default_location || form.bin_location || ''} onChange={e => setForm({ ...form, default_location: e.target.value })} style={inputStyle} />}
                </Field>
                <Field label="Count Group" value={editing ? undefined : (part.count_group || '--')}>
                  {editing && <input value={form.count_group || ''} onChange={e => setForm({ ...form, count_group: e.target.value })} style={inputStyle} />}
                </Field>
                <Field label="Preferred Vendor" value={editing ? undefined : (part.preferred_vendor || part.vendor || '--')}>
                  {editing && <input value={form.preferred_vendor || form.vendor || ''} onChange={e => setForm({ ...form, preferred_vendor: e.target.value })} style={inputStyle} />}
                </Field>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 3fr 2fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

/* --- Sub-components --- */

function Field({ label, value, valueColor, children }: {
  label: string
  value?: string | undefined
  valueColor?: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
        letterSpacing: '.06em', marginBottom: 4,
      }}>{label}</div>
      {children || (
        <div style={{
          fontSize: 14, fontWeight: 500, color: valueColor || '#1A1A1A',
          fontFamily: (label.includes('Cost') || label.includes('Price') || label.includes('Stock') || label.includes('Qty') || label.includes('Margin') || label.includes('Markup') || label.includes('Balance') || label.includes('Allocated') || label.includes('Transit'))
            ? "'IBM Plex Mono', monospace" : "'Instrument Sans', sans-serif",
        }}>{value}</div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: 20,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#1A1A1A',
  marginBottom: 16,
  paddingBottom: 10,
  borderBottom: '1px solid #F3F4F6',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #D1D5DB',
  borderRadius: 6,
  fontSize: 13,
  color: '#1A1A1A',
  fontFamily: "'Instrument Sans', sans-serif",
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
}
