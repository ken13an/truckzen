'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', MUTED = '#7C8BA0'
const stColor: Record<string, string> = { draft: MUTED, sent: BLUE, partial: AMBER, received: GREEN, paid: GREEN }
const STATUS_FLOW = ['draft', 'sent', 'partial', 'received', 'paid']

export default function PODetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [po, setPO] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [tab, setTab] = useState<'overview' | 'lines' | 'receive'>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const [{ data: p }, { data: l }] = await Promise.all([
        supabase.from('maint_purchase_orders').select('*, maint_vendors(name)').eq('id', params.id).single(),
        supabase.from('maint_purchase_order_lines').select('*').eq('purchase_order_id', params.id).order('created_at'),
      ])
      if (!p) { router.push('/maintenance/purchase-orders'); return }
      setPO(p)
      setLines(l || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function updateStatus(status: string) {
    setSaving(true)
    const updates: any = { status }
    if (status === 'received') updates.received_date = new Date().toISOString().split('T')[0]
    await fetch('/api/maintenance/crud', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_purchase_orders', id: params.id, ...updates }),
    })
    setPO((p: any) => ({ ...p, ...updates }))
    setSaving(false)
  }

  async function receiveLine(lineId: string, qty: number) {
    await fetch('/api/maintenance/crud', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_purchase_order_lines', id: lineId, received_qty: qty }),
    })
    setLines(l => l.map(x => x.id === lineId ? { ...x, received_qty: qty } : x))
  }

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const vendor = po.maint_vendors || {}
  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(po.status) + 1]

  const S: Record<string, React.CSSProperties> = {
    card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 16, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#48536A' },
  }

  const tabs = ['overview', 'lines', 'receive'] as const

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>{po.po_number || 'Purchase Order'}</div>
          <div style={{ fontSize: 13, color: MUTED }}>{vendor.name || '—'} · ${(po.total || 0).toFixed(2)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, fontWeight: 700, background: `${stColor[po.status] || MUTED}18`, color: stColor[po.status] || MUTED, textTransform: 'uppercase' }}>{po.status}</span>
          {nextStatus && (
            <button onClick={() => updateStatus(nextStatus)} disabled={saving} style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
              {saving ? '...' : `Mark ${nextStatus}`}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #1B6EE6' : '2px solid transparent',
            color: tab === t ? '#F0F4FF' : MUTED, fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { label: 'Vendor', val: vendor.name || '—' },
              { label: 'Ordered', val: po.ordered_date ? new Date(po.ordered_date).toLocaleDateString() : '—' },
              { label: 'Expected', val: po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—' },
              { label: 'Subtotal', val: `$${(po.subtotal || 0).toFixed(2)}` },
              { label: 'Tax', val: `$${(po.tax || 0).toFixed(2)}` },
              { label: 'Total', val: `$${(po.total || 0).toFixed(2)}` },
            ].map(r => (
              <div key={r.label}><div style={S.label}>{r.label}</div><div style={{ fontSize: 13, color: '#F0F4FF', marginTop: 4, fontWeight: r.label === 'Total' ? 700 : 400 }}>{r.val}</div></div>
            ))}
          </div>
          {po.notes && <div style={{ marginTop: 12 }}><div style={S.label}>Notes</div><div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{po.notes}</div></div>}
        </div>
      )}

      {tab === 'lines' && (
        <div style={S.card}>
          {lines.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#48536A', fontSize: 12 }}>No items</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Description', 'Part #', 'Qty', 'Unit Cost', 'Total'].map(h => (
                <th key={h} style={{ fontFamily: MONO, fontSize: 8, color: '#48536A', textTransform: 'uppercase', padding: '6px 8px', textAlign: 'left', background: '#0B0D11' }}>{h}</th>
              ))}</tr></thead>
              <tbody>{lines.map(l => (
                <tr key={l.id}>
                  <td style={{ padding: 8, fontSize: 12, color: '#F0F4FF' }}>{l.description}</td>
                  <td style={{ padding: 8, fontSize: 10, fontFamily: MONO, color: MUTED }}>{l.part_number || '—'}</td>
                  <td style={{ padding: 8, fontSize: 12, fontFamily: MONO }}>{l.quantity}</td>
                  <td style={{ padding: 8, fontSize: 12, fontFamily: MONO }}>${(l.unit_cost || 0).toFixed(2)}</td>
                  <td style={{ padding: 8, fontSize: 12, fontFamily: MONO, fontWeight: 700 }}>${(l.total || 0).toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'receive' && (
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Receive Items</div>
          {lines.map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <div>
                <div style={{ fontSize: 12, color: '#F0F4FF' }}>{l.description}</div>
                <div style={{ fontSize: 10, color: MUTED }}>Ordered: {l.quantity} · Received: {l.received_qty || 0}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" defaultValue={l.received_qty || 0} min={0} max={l.quantity} style={{ width: 60, padding: '4px 8px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, fontSize: 12, color: '#DDE3EE', textAlign: 'center', fontFamily: MONO }} onBlur={e => receiveLine(l.id, parseFloat(e.target.value) || 0)} />
                {(l.received_qty || 0) >= l.quantity && <span style={{ fontSize: 9, color: GREEN, fontWeight: 700 }}>FULL</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
