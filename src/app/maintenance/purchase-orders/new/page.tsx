'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Plus, Trash2 } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

interface POLine { description: string; part_number: string; quantity: string; unit_cost: string }

export default function NewPOPage() {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [vendors, setVendors] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ vendor_id: '', notes: '' })
  const [lines, setLines] = useState<POLine[]>([{ description: '', part_number: '', quantity: '1', unit_cost: '0' }])

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const { data } = await supabase.from('maint_vendors').select('id, name').eq('shop_id', p.shop_id).eq('active', true).order('name')
      setVendors(data || [])
    })
  }, [])

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vendor_id) { setError('Select a vendor'); return }
    if (!lines.some(l => l.description)) { setError('Add at least one item'); return }
    setSaving(true); setError('')

    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_purchase_orders', shop_id: shopId,
        vendor_id: form.vendor_id, status: 'draft', subtotal, tax: 0, total: subtotal,
        notes: form.notes || null, ordered_date: new Date().toISOString().split('T')[0],
      }),
    })
    if (!res.ok) { setError('Failed to create'); setSaving(false); return }
    const po = await res.json()

    for (const line of lines.filter(l => l.description)) {
      await fetch('/api/maintenance/crud', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'maint_purchase_order_lines', shop_id: shopId,
          purchase_order_id: po.id, description: line.description,
          part_number: line.part_number || null,
          quantity: parseFloat(line.quantity) || 1,
          unit_cost: parseFloat(line.unit_cost) || 0,
          total: (parseFloat(line.quantity) || 1) * (parseFloat(line.unit_cost) || 0),
        }),
      })
    }
    router.push(`/maintenance/purchase-orders/${po.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24, maxWidth: 700, margin: '0 auto' },
    card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tz-textTertiary)', marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: 'var(--tz-inputBg)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, fontSize: 12, color: 'var(--tz-text)', outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    btn: { padding: '12px 24px', background: 'var(--tz-accent)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: 'var(--tz-bgLight)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)', marginBottom: 20 }}>New Purchase Order</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>Vendor *</label>
            <select style={{ ...S.input, appearance: 'none' as const }} value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}>
              <option value="">Select vendor...</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)' }}>Line Items</div>
            <button type="button" onClick={() => setLines(l => [...l, { description: '', part_number: '', quantity: '1', unit_cost: '0' }])} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'rgba(29,111,232,.1)', border: '1px solid rgba(29,111,232,.2)', borderRadius: 6, color: 'var(--tz-accentLight)', fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>
              <Plus size={12} /> Add
            </button>
          </div>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 80px 28px', gap: 6, marginBottom: 6, alignItems: 'end' }}>
              <div><label style={{ ...S.label, fontSize: 7 }}>Description</label><input style={{ ...S.input, padding: '6px 8px', fontSize: 11 }} value={line.description} onChange={e => { const nl = [...lines]; nl[i].description = e.target.value; setLines(nl) }} /></div>
              <div><label style={{ ...S.label, fontSize: 7 }}>Part #</label><input style={{ ...S.input, padding: '6px 8px', fontSize: 11 }} value={line.part_number} onChange={e => { const nl = [...lines]; nl[i].part_number = e.target.value; setLines(nl) }} /></div>
              <div><label style={{ ...S.label, fontSize: 7 }}>Qty</label><input style={{ ...S.input, padding: '6px 8px', fontSize: 11 }} type="number" value={line.quantity} onChange={e => { const nl = [...lines]; nl[i].quantity = e.target.value; setLines(nl) }} /></div>
              <div><label style={{ ...S.label, fontSize: 7 }}>Unit $</label><input style={{ ...S.input, padding: '6px 8px', fontSize: 11 }} type="number" step="0.01" value={line.unit_cost} onChange={e => { const nl = [...lines]; nl[i].unit_cost = e.target.value; setLines(nl) }} /></div>
              <button type="button" onClick={() => setLines(l => l.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D94F4F', padding: 4 }}><Trash2 size={14} /></button>
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: 10, fontFamily: MONO, fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>Total: ${subtotal.toFixed(2)}</div>
        </div>

        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Create Purchase Order'}</button>
      </form>
    </div>
  )
}
