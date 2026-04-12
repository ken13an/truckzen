'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'
import { THEME } from '@/lib/config/colors'
const _t = THEME.dark

const FONT = "'Instrument Sans', sans-serif"
const MONO = "'IBM Plex Mono', monospace"
const BLUE = _t.accent
const PAGE_BG = _t.bg

export default function PartDetailPage() {
  const { tokens: t } = useTheme()
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
  const [activeTab, setActiveTab] = useState<'exceptions' | 'history' | 'pos'>('exceptions')
  const [tabData, setTabData] = useState<any[]>([])
  const [tabLoading, setTabLoading] = useState(false)
  const [poPage, setPoPage] = useState(1)
  const [poTotal, setPoTotal] = useState(0)

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

  // Load tab data when tab changes
  useEffect(() => {
    if (!part || !user) return
    setTabLoading(true)
    setTabData([])
    if (activeTab === 'exceptions') {
      fetch(`/api/parts/${params.id}/pricing-exceptions`).then(r => r.ok ? r.json() : []).then(d => { setTabData(Array.isArray(d) ? d : []); setTabLoading(false) }).catch(() => setTabLoading(false))
    } else if (activeTab === 'history') {
      fetch(`/api/parts/${params.id}/field-history`).then(r => r.ok ? r.json() : []).then(d => { setTabData(Array.isArray(d) ? d : []); setTabLoading(false) }).catch(() => setTabLoading(false))
    } else if (activeTab === 'pos') {
      fetch(`/api/part-history?shop_id=${user.shop_id}&search=${encodeURIComponent(part.part_number || '')}&per_page=25&page=${poPage}`)
        .then(r => r.ok ? r.json() : { data: [], total: 0 })
        .then(d => { setTabData(d.data || []); setPoTotal(d.total || 0); setTabLoading(false) })
        .catch(() => setTabLoading(false))
    }
  }, [activeTab, part, user, poPage])

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
      <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: FONT, padding: 48, textAlign: 'center', color: t.textTertiary }}>
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
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: BLUE, color: t.bgLight, padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
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
              background: status === 'active' ? t.successBg : t.surfaceMuted,
              color: status === 'active' ? t.success : t.textTertiary,
            }}>
              {status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{part.description || 'Untitled Part'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/parts" style={{
            padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgCard,
            color: t.textSecondary, fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit',
          }}>Back to Parts</a>
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', background: BLUE,
              color: t.bgLight, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Edit</button>
          )}
          {editing && (
            <>
              <button onClick={handleCancel} style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgCard,
                color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', background: BLUE,
                color: t.bgLight, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
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
                    <div key={i} style={{ padding: '8px 12px', background: t.bgHover, borderRadius: 6, fontSize: 12, color: t.textSecondary, fontFamily: MONO }}>
                      {typeof ref === 'string' ? ref : (ref.part_number || ref.reference || JSON.stringify(ref))}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: t.textTertiary }}>No cross references</div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Pricing section */}
            <div style={cardStyle}>
              <div style={sectionTitle}>Pricing</div>
              {(() => {
                const cost = part.average_cost ?? part.cost_price ?? 0
                const sell = part.selling_price ?? part.sell_price ?? 0
                return cost > 0 && sell > 0 && sell < cost ? (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(217,119,6,.1)', border: '1px solid rgba(217,119,6,.25)', fontSize: 12, color: t.warning, marginBottom: 12, fontWeight: 600 }}>
                    Sell price below cost — margin is negative
                  </div>
                ) : null
              })()}
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
                <Field label="In Stock" value={editing ? undefined : fmtQty(onHand)} valueColor={onHand > 0 ? BLUE : t.textTertiary}>
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

      {/* Tabs section */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${t.border}`, marginBottom: 16 }}>
          {[
            { key: 'exceptions' as const, label: 'Pricing Exceptions' },
            { key: 'history' as const, label: 'Field History' },
            { key: 'pos' as const, label: 'Purchase Orders' },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === 'pos') setPoPage(1) }} style={{
              padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: activeTab === tab.key ? `2px solid ${BLUE}` : '2px solid transparent',
              color: activeTab === tab.key ? BLUE : t.textTertiary,
              fontWeight: activeTab === tab.key ? 700 : 500, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', marginBottom: -2,
            }}>{tab.label}</button>
          ))}
        </div>

        <div style={cardStyle}>
          {tabLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>Loading...</div>
          ) : activeTab === 'exceptions' ? (
            tabData.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>No pricing exceptions</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                    {['Customer', 'Price', 'Discount', 'Effective Date'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabData.map((row: any) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: t.text }}>{row.customer_name || row.customer_id || '--'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12 }}>{row.price != null ? fmt(row.price) : '--'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: t.textSecondary }}>{row.discount_pct ? `${row.discount_pct}%` : '--'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: t.textSecondary }}>{row.effective_date || row.created_at ? new Date(row.effective_date || row.created_at).toLocaleDateString() : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : activeTab === 'history' ? (
            tabData.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>No history records</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                    {['Date', 'Field', 'Old Value', 'New Value', 'Changed By'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabData.map((row: any) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: t.textSecondary }}>{row.created_at ? new Date(row.created_at).toLocaleDateString() : '--'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: t.text }}>{row.field_name || '--'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 11, color: t.textTertiary }}>{row.old_value ?? '--'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 11, color: t.text }}>{row.new_value ?? '--'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: t.textSecondary }}>{row.changed_by_name || row.changed_by || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            /* Purchase Orders tab */
            tabData.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>No purchase orders</div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      {['PO #', 'Vendor', 'Date', 'Qty', 'Unit Cost', 'Total'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tabData.map((row: any) => (
                      <tr key={row.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE }}>{row.po_number || '--'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: t.text }}>{row.vendor || '--'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: t.textSecondary }}>{row.date ? new Date(row.date).toLocaleDateString() : '--'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12 }}>{row.quantity ?? '--'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: t.textSecondary }}>{row.cost_price != null ? fmt(row.cost_price) : '--'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>{row.cost_price != null && row.quantity != null ? fmt(row.cost_price * row.quantity) : '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {poTotal > 25 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0', fontSize: 12 }}>
                    <button disabled={poPage <= 1} onClick={() => setPoPage(p => p - 1)} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgCard, color: poPage <= 1 ? t.textTertiary : t.textSecondary, cursor: poPage <= 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>Previous</button>
                    <span style={{ color: t.textSecondary, lineHeight: '28px' }}>Page {poPage} of {Math.ceil(poTotal / 25)}</span>
                    <button disabled={poPage >= Math.ceil(poTotal / 25)} onClick={() => setPoPage(p => p + 1)} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgCard, color: poPage >= Math.ceil(poTotal / 25) ? t.textTertiary : t.textSecondary, cursor: poPage >= Math.ceil(poTotal / 25) ? 'default' : 'pointer', fontFamily: 'inherit' }}>Next</button>
                  </div>
                )}
              </>
            )
          )}
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
        fontSize: 10, fontWeight: 600, color: _t.textTertiary, textTransform: 'uppercase',
        letterSpacing: '.06em', marginBottom: 4,
      }}>{label}</div>
      {children || (
        <div style={{
          fontSize: 14, fontWeight: 500, color: valueColor || _t.text,
          fontFamily: (label.includes('Cost') || label.includes('Price') || label.includes('Stock') || label.includes('Qty') || label.includes('Margin') || label.includes('Markup') || label.includes('Balance') || label.includes('Allocated') || label.includes('Transit'))
            ? "'IBM Plex Mono', monospace" : "'Instrument Sans', sans-serif",
        }}>{value}</div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: _t.bgCard,
  border: `1px solid ${_t.cardBorder}`,
  borderRadius: 12,
  padding: 20,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: _t.text,
  marginBottom: 16,
  paddingBottom: 10,
  borderBottom: `1px solid ${_t.border}`,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: `1px solid ${_t.inputBorder}`,
  borderRadius: 6,
  fontSize: 13,
  color: _t.text,
  fontFamily: "'Instrument Sans', sans-serif",
  outline: 'none',
  background: _t.inputBg,
  boxSizing: 'border-box',
}
