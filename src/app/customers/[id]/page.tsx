'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

type Tab = 'overview' | 'fleet' | 'history' | 'open' | 'invoices'

export default function CustomerPortalPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [edit, setEdit] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState('')

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setUser(profile)

      const res = await fetch(`/api/customers/${params.id}?shop_id=${profile.shop_id}`)
      if (!res.ok) { router.push('/customers'); return }
      const data = await res.json()
      setCustomer(data)
      setEdit({ company_name: data.company_name, contact_name: data.contact_name, phone: data.phone, email: data.email, address: data.address, notes: data.notes })
      setLoading(false)
    }
    load()
  }, [params.id])

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/customers/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    })
    if (res.ok) {
      const updated = await res.json()
      setCustomer((c: any) => ({ ...c, ...updated }))
      setEditing(false)
      flash('Saved')
    }
    setSaving(false)
  }

  if (loading) return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E8E93' }}>Loading...</div>

  const vehicles = customer?.assets || []
  const kioskCheckins = customer?.kiosk_checkins || []
  const allSOs = customer?.service_orders || []
  const openSOs = allSOs.filter((s: any) => !['good_to_go', 'void'].includes(s.status))
  const closedSOs = allSOs.filter((s: any) => ['good_to_go', 'void', 'done'].includes(s.status))
  const invoices = customer?.invoices || []
  const totalSpent = invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.total || 0), 0)
  const outstanding = invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'void').reduce((s: number, i: any) => s + ((i.total || 0) - (i.amount_paid || 0)), 0)
  const lastService = allSOs.length > 0 ? allSOs.sort((a: any, b: any) => b.created_at?.localeCompare(a.created_at))[0]?.created_at?.split('T')[0] : null

  return (
    <div style={S.page}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#0A84FF', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <a href="/customers" style={{ fontSize: 12, color: '#8E8E93', textDecoration: 'none', display: 'block', marginBottom: 16 }}>← Customers</a>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={S.title}>{customer.company_name}</div>
            <button onClick={() => setEditing(!editing)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#0A84FF', padding: 4, fontWeight: 600 }} title="Edit">Edit</button>
          </div>
          <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4 }}>
            {vehicles.length} unit{vehicles.length !== 1 ? 's' : ''} · {allSOs.length} service order{allSOs.length !== 1 ? 's' : ''} · {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`/orders/new?customer=${params.id}`} style={{ ...S.btn, background: 'linear-gradient(135deg,#0A84FF,#0A84FF)', color: '#fff', textDecoration: 'none' }}>+ New Service Order</a>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}`, color: '#0A84FF' },
          { label: 'Outstanding', value: `$${outstanding.toLocaleString()}`, color: outstanding > 0 ? '#FFD60A' : '#8E8E93' },
          { label: 'Open Orders', value: String(openSOs.length), color: openSOs.length > 0 ? '#0A84FF' : '#8E8E93' },
          { label: 'Last Service', value: lastService || 'Never', color: '#8E8E93' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 18px', flex: '1 1 120px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "'IBM Plex Mono'" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.06)', paddingBottom: 0 }}>
        {([['overview', 'Overview'], ['fleet', `Fleet (${vehicles.length})`], ['history', 'Service History'], ['open', `Open Orders (${openSOs.length})`], ['invoices', `Invoices (${invoices.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: tab === k ? '2px solid #0A84FF' : '2px solid transparent', color: tab === k ? '#0A84FF' : '#8E8E93', background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: tab === k ? '#0A84FF' : 'transparent' }}>
            {l}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (<>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 14 }}>Contact Information</div>
          {editing ? (
            <>
              <div style={S.row2}>
                <div><label style={S.label}>Company Name</label><input style={S.input} value={edit?.company_name || ''} onChange={e => setEdit((c: any) => ({ ...c, company_name: e.target.value }))} /></div>
                <div><label style={S.label}>Contact Person</label><input style={S.input} value={edit?.contact_name || ''} onChange={e => setEdit((c: any) => ({ ...c, contact_name: e.target.value }))} /></div>
              </div>
              <div style={S.row2}>
                <div><label style={S.label}>Phone</label><input style={S.input} value={edit?.phone || ''} onChange={e => setEdit((c: any) => ({ ...c, phone: e.target.value }))} /></div>
                <div><label style={S.label}>Email</label><input style={S.input} type="email" value={edit?.email || ''} onChange={e => setEdit((c: any) => ({ ...c, email: e.target.value }))} /></div>
              </div>
              <div><label style={S.label}>Address</label><input style={S.input} value={edit?.address || ''} onChange={e => setEdit((c: any) => ({ ...c, address: e.target.value }))} /></div>
              <div style={{ marginTop: 10 }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={edit?.notes || ''} onChange={e => setEdit((c: any) => ({ ...c, notes: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={save} disabled={saving} style={{ ...S.btn, background: 'linear-gradient(135deg,#0A84FF,#0A84FF)', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</button>
                <button onClick={() => setEditing(false)} style={{ ...S.btn, background: '#2A2A2A', color: '#8E8E93' }}>Cancel</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Company', customer.company_name],
                ['Contact', customer.contact_name],
                ['Phone', customer.phone],
                ['Email', customer.email],
                ['Address', customer.address],
                ['Notes', customer.notes],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <div style={{ fontSize: 10, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 13, color: v ? '#F5F5F7' : '#8E8E93' }}>{(v as string) || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Check-ins in Overview */}
        {kioskCheckins.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 12 }}>Recent Check-ins</div>
            {kioskCheckins.slice(0, 5).map((ci: any) => (
              <div key={ci.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#F5F5F7' }}>#{ci.unit_number} — {ci.contact_name || 'Driver'}</div>
                  <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>{ci.complaint_en ? ci.complaint_en.slice(0, 60) : 'No description'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#8E8E93' }}>{new Date(ci.created_at).toLocaleDateString()}</div>
                  <div style={{ fontSize: 9, color: '#8E8E93', fontFamily: 'monospace' }}>{ci.checkin_ref}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* FLEET TAB */}
      {tab === 'fleet' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7' }}>Fleet — {vehicles.length} units</div>
          </div>
          {vehicles.length === 0 ? <div style={{ color: '#8E8E93', textAlign: 'center', padding: 24 }}>No vehicles</div> : (
            <table style={S.table}>
              <thead><tr>
                {['Unit #', 'Year', 'Make', 'Model', 'VIN', 'Odometer', 'Status', ''].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {vehicles.map((v: any) => (
                  <tr key={v.id}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#0A84FF' }}>#{v.unit_number}</td>
                    <td style={S.td}>{v.year}</td>
                    <td style={S.td}>{v.make}</td>
                    <td style={S.td}>{v.model}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 10 }}>{v.vin || '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>{v.odometer?.toLocaleString() || '—'}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: v.status === 'on_road' ? '#0A84FF' : '#8E8E93' }}>{v.status?.replace(/_/g, ' ')}</span></td>
                    <td style={S.td}>
                      <a href={`/orders/new?customer=${params.id}&asset=${v.id}`} style={{ fontSize: 10, color: '#0A84FF', textDecoration: 'none', fontWeight: 600 }}>+ SO</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* SERVICE HISTORY TAB */}
      {tab === 'history' && (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 14 }}>Service History — {closedSOs.length} completed</div>
          {closedSOs.length === 0 ? <div style={{ color: '#8E8E93', textAlign: 'center', padding: 24 }}>No completed service orders</div> : (
            <table style={S.table}>
              <thead><tr>
                {['SO #', 'Date', 'Truck', 'Complaint', 'Labor', 'Parts', 'Total', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {closedSOs.map((so: any) => (
                  <tr key={so.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/orders/${so.id}`)}>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#0A84FF', fontWeight: 600 }}>{so.so_number}</td>
                    <td style={S.td}>{so.created_at?.split('T')[0]}</td>
                    <td style={S.td}>#{(so.assets as any)?.unit_number || '—'}</td>
                    <td style={{ ...S.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{so.complaint || '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>${so.labor_total || 0}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>${so.parts_total || 0}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700 }}>${so.grand_total || 0}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: so.status === 'good_to_go' ? '#0A84FF' : '#8E8E93' }}>{so.status?.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* OPEN ORDERS TAB */}
      {tab === 'open' && (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 14 }}>Open Orders — {openSOs.length} active</div>
          {openSOs.length === 0 ? <div style={{ color: '#8E8E93', textAlign: 'center', padding: 24 }}>No open orders</div> : (
            <table style={S.table}>
              <thead><tr>
                {['SO #', 'Truck', 'Complaint', 'Mechanic', 'Status', 'Priority', 'Total'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {openSOs.map((so: any) => (
                  <tr key={so.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/orders/${so.id}`)}>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#0A84FF', fontWeight: 600 }}>{so.so_number}</td>
                    <td style={S.td}>#{(so.assets as any)?.unit_number || '—'}</td>
                    <td style={{ ...S.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{so.complaint || '—'}</td>
                    <td style={S.td}>{(so.users as any)?.full_name || <span style={{ color: '#8E8E93' }}>Unassigned</span>}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: so.status === 'in_progress' ? '#FFD60A' : so.status === 'waiting_parts' ? '#FFD60A' : '#8E8E93' }}>{so.status?.replace(/_/g, ' ')}</span></td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: so.priority === 'critical' ? '#FF453A' : so.priority === 'high' ? '#FFD60A' : '#8E8E93' }}>{so.priority}</span></td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700 }}>${so.grand_total || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* INVOICES TAB */}
      {tab === 'invoices' && (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 14 }}>Invoices — {invoices.length} total</div>
          {invoices.length === 0 ? <div style={{ color: '#8E8E93', textAlign: 'center', padding: 24 }}>No invoices</div> : (
            <table style={S.table}>
              <thead><tr>
                {['Invoice #', 'Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/invoices/${inv.id}`)}>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#0A84FF', fontWeight: 600 }}>{inv.invoice_number}</td>
                    <td style={S.td}>{inv.created_at?.split('T')[0]}</td>
                    <td style={S.td}>{inv.due_date || '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>${(inv.total || 0).toFixed(2)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>${(inv.amount_paid || 0).toFixed(2)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: (inv.balance_due || 0) > 0 ? '#FFD60A' : '#0A84FF' }}>${(inv.balance_due || 0).toFixed(2)}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: inv.status === 'paid' ? '#0A84FF' : inv.status === 'sent' ? '#0A84FF' : inv.status === 'overdue' ? '#FF453A' : '#8E8E93' }}>{inv.status}</span></td>
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

const S: Record<string, React.CSSProperties> = {
  page: { background: '#0A0A0A', minHeight: '100vh', color: '#F5F5F7', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F5F5F7' },
  card: { background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 12, padding: 20, marginBottom: 16 },
  label: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#8E8E93', marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '9px 12px', background: '#2A2A2A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#F5F5F7', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  btn: { padding: '9px 18px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-block' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11 },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: '#8E8E93', textTransform: 'uppercase' as const, letterSpacing: '.08em', padding: '7px 10px', textAlign: 'left' as const, background: '#0A0A0A', whiteSpace: 'nowrap' as const },
  td: { padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 11, color: '#8E8E93' },
}
