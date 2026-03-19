'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Loader2, Plus } from 'lucide-react'

type Tab = 'orders' | 'requests' | 'mechanic' | 'completed'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:                  { label: 'Draft',           cls: 'text-text-tertiary bg-text-tertiary/15' },
  not_approved:           { label: 'Not Approved',    cls: 'text-warning bg-warning/15' },
  waiting_approval:       { label: 'Waiting Approval',cls: 'text-warning bg-warning/15' },
  in_progress:            { label: 'In Progress',     cls: 'text-teal bg-teal/15' },
  waiting_parts:          { label: 'Waiting Parts',   cls: 'text-warning bg-warning/15' },
  done:                   { label: 'Done',            cls: 'text-success bg-success/15' },
  ready_final_inspection: { label: 'Ready Inspection',cls: 'text-purple bg-purple/15' },
  good_to_go:             { label: 'Good to Go',      cls: 'text-success bg-success/15' },
  failed_inspection:      { label: 'Failed',          cls: 'text-error bg-error/15' },
}

export default function OrdersPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('orders')
  const [orders, setOrders] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [mechRequests, setMechRequests] = useState<any[]>([])
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    const timeout = setTimeout(() => { if (!cancelled && loading) { setLoading(false); setError('Page took too long to load.') } }, 15000)

    async function load() {
      try {
        const profile = await getCurrentUser(supabase)
        if (cancelled) return
        if (!profile) { window.location.href = '/login'; return }
        setUser(profile)

        const shopId = profile.shop_id
        const results = await Promise.allSettled([
          fetch(`/api/service-orders?shop_id=${shopId}&role=${profile.role}&user_team=${profile.team ?? ''}&limit=100`).then(r => r.ok ? r.json() : []),
          fetch(`/api/service-requests?shop_id=${shopId}`).then(r => r.ok ? r.json() : []),
          fetch(`/api/mechanic-requests?shop_id=${shopId}`).then(r => r.ok ? r.json() : []),
          fetch(`/api/service-orders?shop_id=${shopId}&status=good_to_go&limit=50`).then(r => r.ok ? r.json() : []),
        ])

        if (cancelled) return
        const [o, r, m, c] = results
        setOrders(o.status === 'fulfilled' && Array.isArray(o.value) ? o.value : [])
        setRequests(r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [])
        setMechRequests(m.status === 'fulfilled' && Array.isArray(m.value) ? m.value : [])
        setCompletedOrders(c.status === 'fulfilled' && Array.isArray(c.value) ? c.value : [])
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t === 'requests') setTab('requests')
      if (t === 'mechanic') setTab('mechanic')
    }
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [])

  const filtered = orders.filter(so => {
    if (statusFilter !== 'all' && so.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(so.so_number?.toLowerCase().includes(q) || (so.assets as any)?.unit_number?.toLowerCase().includes(q) || (so.customers as any)?.company_name?.toLowerCase().includes(q) || so.complaint?.toLowerCase().includes(q))) return false
    }
    return true
  })

  const newReqs = (requests ?? []).filter((r: any) => r.status === 'new')
  const pendingMech = (mechRequests ?? []).filter((r: any) => r.status === 'pending')

  async function convertRequest(id: string) {
    const res = await fetch('/api/service-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'convert', request_id: id, user_id: user?.id }) })
    const d = await res.json()
    if (d.so_id) window.location.href = '/orders/' + d.so_id
  }

  async function rejectRequest(id: string) {
    await fetch('/api/service-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject', request_id: id, reason: 'Rejected' }) })
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  async function respondMech(id: string, st: string) {
    await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'respond', request_id: id, status: st, response_note: st === 'approved' ? 'Approved' : 'Denied', responded_by: user?.id }) })
    setMechRequests(prev => prev.map(r => r.id === id ? { ...r, status: st } : r))
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center flex-col gap-3">
      <Loader2 size={24} className="animate-spin text-teal" />
      <span className="text-sm text-text-secondary">Loading repair orders...</span>
    </div>
  )

  const TABS: { key: Tab; label: string; badge?: number; cls: string }[] = [
    { key: 'orders', label: `All Orders (${orders.length})`, cls: 'text-teal' },
    { key: 'requests', label: 'Service Requests', badge: newReqs.length, cls: 'text-warning' },
    { key: 'mechanic', label: 'Mechanic Actions', badge: pendingMech.length, cls: 'text-purple' },
    { key: 'completed', label: `Completed (${completedOrders.length})`, cls: 'text-success' },
  ]

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      {error && <div className="px-3 py-2.5 bg-error/10 border border-error/20 rounded-md text-xs text-error mb-4">{error}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Repair Orders</h1>
          <p className="text-sm text-text-secondary">{filtered.length} orders &middot; {newReqs.length} requests &middot; {pendingMech.length} mechanic actions</p>
        </div>
        <a href="/orders/new" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors duration-150 no-underline">
          <Plus size={16} strokeWidth={2} /> New Repair Order
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors duration-150 ${tab === t.key ? `bg-surface-2 ${t.cls}` : 'text-text-tertiary hover:text-text-secondary'}`}>
            {t.label}
            {(t.badge ?? 0) > 0 && <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${t.key === 'requests' ? 'bg-warning text-bg' : 'bg-purple text-white'}`}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* TAB 1: ALL ORDERS */}
      {tab === 'orders' && <>
        <div className="flex gap-2 flex-wrap mb-3 items-center">
          <input className="px-3 py-2 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors duration-150 w-52"
            placeholder="RO, unit, customer..." value={search} onChange={e => setSearch(e.target.value)} />
          {['all', 'draft', 'in_progress', 'waiting_parts', 'good_to_go'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150 ${statusFilter === s ? 'bg-teal/10 text-teal border border-teal/30' : 'bg-surface-2 text-text-tertiary border border-brand-border hover:text-text-secondary'}`}>
              {s === 'all' ? 'All' : STATUS_MAP[s]?.label ?? s}
            </button>
          ))}
        </div>
        <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-text-secondary text-sm">No repair orders yet. Create one to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr className="bg-surface-2">
                  {['RO', 'Unit', 'Customer', 'Complaint', 'Tech', 'Status', 'Priority', 'Total'].map(h => (
                    <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(so => {
                    const st = STATUS_MAP[so.status] ?? { label: so.status, cls: 'text-text-tertiary bg-text-tertiary/15' }
                    return (
                      <tr key={so.id} className="border-b border-brand-border/50 hover:bg-surface-2 cursor-pointer transition-colors duration-150" onClick={() => window.location.href = `/orders/${so.id}`}>
                        <td className="px-3 py-2.5 font-mono text-xs text-teal font-bold">{so.so_number}</td>
                        <td className="px-3 py-2.5 text-sm font-semibold text-text-primary">#{(so.assets as any)?.unit_number ?? '?'}</td>
                        <td className="px-3 py-2.5 text-sm text-text-secondary">{(so.customers as any)?.company_name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-text-secondary max-w-[180px] truncate">{so.complaint ?? '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-text-secondary">{(so.users as any)?.full_name ?? '—'}</td>
                        <td className="px-3 py-2.5"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${st.cls}`}>{st.label}</span></td>
                        <td className="px-3 py-2.5"><span className={`text-[10px] font-bold uppercase font-mono ${so.priority === 'critical' ? 'text-error' : so.priority === 'high' ? 'text-warning' : 'text-text-tertiary'}`}>{so.priority?.toUpperCase()}</span></td>
                        <td className="px-3 py-2.5 font-mono text-sm">{so.grand_total ? `$${so.grand_total.toFixed(0)}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>}

      {/* TAB 2: SERVICE REQUESTS */}
      {tab === 'requests' && (
        <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
          {(requests ?? []).length === 0 ? <div className="py-12 text-center text-text-secondary text-sm">No service requests. Check-ins from the kiosk appear here.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr className="bg-surface-2">
                  {['Source', 'Customer', 'Unit', 'Description', 'Created', 'Status', 'Actions'].map(h => <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {requests.map((r: any) => (
                    <tr key={r.id} className="border-b border-brand-border/50">
                      <td className="px-3 py-2.5 text-[10px] uppercase text-text-tertiary">{r.source?.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2.5 text-sm font-semibold text-text-primary">{r.company_name ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-teal">#{r.unit_number ?? '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-text-secondary max-w-[220px] truncate">{r.description}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-text-tertiary">{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td className="px-3 py-2.5"><span className={`text-[10px] font-bold uppercase ${r.status === 'new' ? 'text-warning' : r.status === 'converted' ? 'text-success' : 'text-error'}`}>{r.status}</span></td>
                      <td className="px-3 py-2.5">
                        {r.status === 'new' ? (
                          <div className="flex gap-1.5">
                            <button onClick={() => convertRequest(r.id)} className="px-2.5 py-1 bg-teal text-bg rounded-sm text-[10px] font-bold hover:bg-teal-hover transition-colors">Convert to RO</button>
                            <button onClick={() => rejectRequest(r.id)} className="px-2.5 py-1 border border-error/30 text-error rounded-sm text-[10px] font-semibold hover:bg-error/10 transition-colors">Reject</button>
                          </div>
                        ) : r.converted_so_id ? <a href={`/orders/${r.converted_so_id}`} className="text-xs text-teal no-underline hover:underline">View RO</a> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MECHANIC ACTIONS */}
      {tab === 'mechanic' && (
        <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
          {(mechRequests ?? []).length === 0 ? <div className="py-12 text-center text-text-secondary text-sm">No mechanic action requests.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr className="bg-surface-2">
                  {['RO', 'Mechanic', 'Type', 'Description', 'Created', 'Status', 'Actions'].map(h => <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {mechRequests.map((r: any) => (
                    <tr key={r.id} className="border-b border-brand-border/50">
                      <td className="px-3 py-2.5 font-mono text-xs text-teal">{(r.service_orders as any)?.so_number ?? '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-text-primary">{(r.users as any)?.full_name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[10px] uppercase text-purple font-bold">{r.request_type?.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2.5 text-sm text-text-secondary max-w-[200px] truncate">{r.description}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-text-tertiary">{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td className="px-3 py-2.5"><span className={`text-[10px] font-bold uppercase ${r.status === 'pending' ? 'text-warning' : r.status === 'approved' ? 'text-success' : 'text-error'}`}>{r.status}</span></td>
                      <td className="px-3 py-2.5">
                        {r.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => respondMech(r.id, 'approved')} className="px-2.5 py-1 bg-success text-bg rounded-sm text-[10px] font-bold hover:opacity-90 transition-opacity">Approve</button>
                            <button onClick={() => respondMech(r.id, 'denied')} className="px-2.5 py-1 border border-error/30 text-error rounded-sm text-[10px] font-semibold hover:bg-error/10 transition-colors">Deny</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMPLETED */}
      {tab === 'completed' && (
        <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
          {(completedOrders ?? []).length === 0 ? <div className="py-12 text-center text-text-secondary text-sm">No completed orders yet.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead><tr className="bg-surface-2">
                  {['RO', 'Unit', 'Customer', 'Complaint', 'Total', 'Completed'].map(h => <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {completedOrders.map((so: any) => (
                    <tr key={so.id} className="border-b border-brand-border/50 hover:bg-surface-2 cursor-pointer transition-colors" onClick={() => window.location.href = `/orders/${so.id}`}>
                      <td className="px-3 py-2.5 font-mono text-xs text-teal font-bold">{so.so_number}</td>
                      <td className="px-3 py-2.5 text-sm font-semibold text-text-primary">#{(so.assets as any)?.unit_number}</td>
                      <td className="px-3 py-2.5 text-sm text-text-secondary">{(so.customers as any)?.company_name}</td>
                      <td className="px-3 py-2.5 text-sm text-text-secondary max-w-[200px] truncate">{so.complaint}</td>
                      <td className="px-3 py-2.5 font-mono text-sm">{so.grand_total ? `$${so.grand_total.toFixed(0)}` : '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-text-tertiary">{so.completed_at ? new Date(so.completed_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
