'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
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

  if (loading) return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0' }}>Loading...</div>

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
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#1D6FE8', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <a href="/customers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#EDEDF0', textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Customers
</a>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={S.title}>{customer.company_name}</div>
            <button onClick={() => setEditing(!editing)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#4D9EFF', padding: 4, fontFamily: 'inherit', fontWeight: 600 }} title="Edit">Edit</button>
          </div>
          <div style={{ fontSize: 12, color: '#7C8BA0', marginTop: 4 }}>
            {vehicles.length} unit{vehicles.length !== 1 ? 's' : ''} · {allSOs.length} service order{allSOs.length !== 1 ? 's' : ''} · {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`/orders/new?customer=${params.id}`} style={{ ...S.btn, background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: '#fff', textDecoration: 'none' }}>+ New Service Order</a>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}`, color: '#22C55E' },
          { label: 'Outstanding', value: `$${outstanding.toLocaleString()}`, color: outstanding > 0 ? '#F59E0B' : '#48536A' },
          { label: 'Open Orders', value: String(openSOs.length), color: openSOs.length > 0 ? '#4D9EFF' : '#48536A' },
          { label: 'Last Service', value: lastService || 'Never', color: '#7C8BA0' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 10, padding: '12px 18px', flex: '1 1 120px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "'IBM Plex Mono'" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.06)', paddingBottom: 0 }}>
        {([['overview', 'Overview'], ['fleet', `Fleet (${vehicles.length})`], ['history', 'Service History'], ['open', `Open Orders (${openSOs.length})`], ['invoices', `Invoices (${invoices.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: tab === k ? '2px solid #4D9EFF' : '2px solid transparent', color: tab === k ? '#4D9EFF' : '#7C8BA0', background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: tab === k ? '#4D9EFF' : 'transparent' }}>
            {l}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (<>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 14 }}>Contact Information</div>
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
                <button onClick={save} disabled={saving} style={{ ...S.btn, background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</button>
                <button onClick={() => setEditing(false)} style={{ ...S.btn, background: '#1A1D23', color: '#7C8BA0' }}>Cancel</button>
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
                  <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 13, color: v ? '#DDE3EE' : '#48536A' }}>{(v as string) || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Check-ins in Overview */}
        {kioskCheckins.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Recent Check-ins</div>
            {kioskCheckins.slice(0, 5).map((ci: any) => (
              <div key={ci.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#F0F4FF' }}>#{ci.unit_number} — {ci.contact_name || 'Driver'}</div>
                  <div style={{ fontSize: 10, color: '#7C8BA0', marginTop: 1 }}>{ci.complaint_en ? ci.complaint_en.slice(0, 60) : 'No description'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#7C8BA0' }}>{new Date(ci.created_at).toLocaleDateString()}</div>
                  <div style={{ fontSize: 9, color: '#48536A', fontFamily: 'monospace' }}>{ci.checkin_ref}</div>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>Fleet — {vehicles.length} units</div>
          </div>
          {vehicles.length === 0 ? <div style={{ color: '#48536A', textAlign: 'center', padding: 24 }}>No vehicles</div> : (
            <table style={S.table}>
              <thead><tr>
                {['Unit #', 'Year', 'Make', 'Model', 'VIN', 'Odometer', 'Status', ''].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {vehicles.map((v: any) => (
                  <tr key={v.id}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#4D9EFF' }}>#{v.unit_number}</td>
                    <td style={S.td}>{v.year}</td>
                    <td style={S.td}>{v.make}</td>
                    <td style={S.td}>{v.model}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 10 }}>{v.vin || '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>{v.odometer?.toLocaleString() || '—'}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: v.status === 'on_road' ? '#22C55E' : '#7C8BA0' }}>{v.status?.replace(/_/g, ' ')}</span></td>
                    <td style={S.td}>
                      <a href={`/orders/new?customer=${params.id}&asset=${v.id}`} style={{ fontSize: 10, color: '#4D9EFF', textDecoration: 'none', fontWeight: 600 }}>+ SO</a>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 14 }}>Service History — {closedSOs.length} completed</div>
          {closedSOs.length === 0 ? <div style={{ color: '#48536A', textAlign: 'center', padding: 24 }}>No completed service orders</div> : (
            <table style={S.table}>
              <thead><tr>
                {['SO #', 'Date', 'Truck', 'Complaint', 'Labor', 'Parts', 'Total', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {closedSOs.map((so: any) => (
                  <tr key={so.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/orders/${so.id}`)}>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#4D9EFF', fontWeight: 600 }}>{so.so_number}</td>
                    <td style={S.td}>{so.created_at?.split('T')[0]}</td>
                    <td style={S.td}>#{(so.assets as any)?.unit_number || '—'}</td>
                    <td style={{ ...S.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{so.complaint || '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>${so.labor_total || 0}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>${so.parts_total || 0}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700 }}>${so.grand_total || 0}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: so.status === 'good_to_go' ? '#22C55E' : '#7C8BA0' }}>{so.status?.replace(/_/g, ' ')}</span></td>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 14 }}>Open Orders — {openSOs.length} active</div>
          {openSOs.length === 0 ? <div style={{ color: '#48536A', textAlign: 'center', padding: 24 }}>No open orders</div> : (
            <table style={S.table}>
              <thead><tr>
                {['SO #', 'Truck', 'Complaint', 'Mechanic', 'Status', 'Priority', 'Total'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {openSOs.map((so: any) => (
                  <tr key={so.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/orders/${so.id}`)}>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#4D9EFF', fontWeight: 600 }}>{so.so_number}</td>
                    <td style={S.td}>#{(so.assets as any)?.unit_number || '—'}</td>
                    <td style={{ ...S.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{so.complaint || '—'}</td>
                    <td style={S.td}>{(so.users as any)?.full_name || <span style={{ color: '#48536A' }}>Unassigned</span>}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: so.status === 'in_progress' ? '#F59E0B' : so.status === 'waiting_parts' ? '#F59E0B' : '#7C8BA0' }}>{so.status?.replace(/_/g, ' ')}</span></td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: so.priority === 'critical' ? '#EF4444' : so.priority === 'high' ? '#F59E0B' : '#7C8BA0' }}>{so.priority}</span></td>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 14 }}>Invoices — {invoices.length} total</div>
          {invoices.length === 0 ? <div style={{ color: '#48536A', textAlign: 'center', padding: 24 }}>No invoices</div> : (
            <table style={S.table}>
              <thead><tr>
                {['Invoice #', 'Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/invoices/${inv.id}`)}>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#4D9EFF', fontWeight: 600 }}>{inv.invoice_number}</td>
                    <td style={S.td}>{inv.created_at?.split('T')[0]}</td>
                    <td style={S.td}>{inv.due_date || '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>${(inv.total || 0).toFixed(2)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>${(inv.amount_paid || 0).toFixed(2)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: (inv.balance_due || 0) > 0 ? '#F59E0B' : '#22C55E' }}>${(inv.balance_due || 0).toFixed(2)}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: inv.status === 'paid' ? '#22C55E' : inv.status === 'sent' ? '#4D9EFF' : inv.status === 'overdue' ? '#EF4444' : '#7C8BA0' }}>{inv.status}</span></td>
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
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' },
  card: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 20, marginBottom: 16 },
  label: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#48536A', marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  btn: { padding: '9px 18px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-block' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11 },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: '#48536A', textTransform: 'uppercase' as const, letterSpacing: '.08em', padding: '7px 10px', textAlign: 'left' as const, background: '#0B0D11', whiteSpace: 'nowrap' as const },
  td: { padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 11, color: '#A0AABF' },
}
