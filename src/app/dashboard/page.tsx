'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { Loader2, Truck } from 'lucide-react'

interface DashStats {
  open_jobs: number
  in_progress: number
  waiting_parts: number
  good_to_go: number
  low_stock_parts: number
  overdue_invoices: number
  overdue_pm: number
}

const STATUS_COLOR: Record<string, string> = {
  in_progress: 'text-teal', waiting_parts: 'text-warning', waiting_approval: 'text-warning',
  not_approved: 'text-warning', done: 'text-success', good_to_go: 'text-success',
  ready_final_inspection: 'text-purple', failed_inspection: 'text-error', draft: 'text-text-tertiary',
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'In Progress', waiting_parts: 'Waiting Parts', waiting_approval: 'Waiting Approval',
  not_approved: 'Not Approved', done: 'Done', good_to_go: 'Good to Go',
  ready_final_inspection: 'Ready Inspection', failed_inspection: 'Failed', draft: 'Draft',
}

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<DashStats | null>(null)
  const [recentSOs, setRecentSOs] = useState<any[]>([])
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)
      const shopId = profile.shop_id

      const [{ data: soData }, { data: partsData }, { data: invoiceData }, { data: pmData }] = await Promise.all([
        supabase.from('service_orders').select('status').eq('shop_id', shopId).not('status', 'in', '("void")'),
        supabase.from('parts').select('on_hand, reorder_point').eq('shop_id', shopId),
        supabase.from('invoices').select('status, due_date').eq('shop_id', shopId).eq('status', 'sent'),
        supabase.from('pm_schedules').select('next_due_date').eq('shop_id', shopId).eq('active', true),
      ])

      const today = new Date().toISOString().split('T')[0]
      setStats({
        open_jobs:       (soData ?? []).filter((s: any) => !['good_to_go', 'void'].includes(s.status)).length,
        in_progress:     (soData ?? []).filter((s: any) => s.status === 'in_progress').length,
        waiting_parts:   (soData ?? []).filter((s: any) => s.status === 'waiting_parts').length,
        good_to_go:      (soData ?? []).filter((s: any) => s.status === 'good_to_go').length,
        low_stock_parts: (partsData ?? []).filter((p: any) => p.on_hand <= p.reorder_point).length,
        overdue_invoices:(invoiceData ?? []).filter((i: any) => i.due_date && i.due_date < today).length,
        overdue_pm:      (pmData ?? []).filter((p: any) => p.next_due_date && p.next_due_date < today).length,
      })

      const { data: sos } = await supabase
        .from('service_orders')
        .select('id, so_number, status, priority, created_at, assets(unit_number, make, model), customers(company_name), users!assigned_tech(full_name)')
        .eq('shop_id', shopId).not('status', 'in', '("void")').order('created_at', { ascending: false }).limit(8)
      setRecentSOs(sos ?? [])

      const ciRes = await fetch(`/api/kiosk?shop_id=${shopId}&limit=5`)
      if (ciRes.ok) { const ciData = await ciRes.json(); setCheckins(Array.isArray(ciData) ? ciData : []) }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-teal" />
    </div>
  )

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          {greeting()}, {user?.full_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mb-6">
          {[
            { label: 'Open Jobs', val: stats.open_jobs, color: 'text-text-primary', href: '/orders' },
            { label: 'In Progress', val: stats.in_progress, color: 'text-teal', href: '/shop-floor' },
            { label: 'Waiting Parts', val: stats.waiting_parts, color: 'text-warning', href: '/orders?status=waiting_parts' },
            { label: 'Good to Go', val: stats.good_to_go, color: 'text-success', href: '/orders?status=good_to_go' },
            { label: 'Low Stock', val: stats.low_stock_parts, color: stats.low_stock_parts > 0 ? 'text-error' : 'text-success', href: '/parts' },
            { label: 'Overdue Inv.', val: stats.overdue_invoices, color: stats.overdue_invoices > 0 ? 'text-warning' : 'text-success', href: '/invoices' },
            { label: 'PM Overdue', val: stats.overdue_pm, color: stats.overdue_pm > 0 ? 'text-error' : 'text-success', href: '/maintenance' },
          ].map(s => (
            <a key={s.label} href={s.href} className="no-underline group">
              <div className="bg-surface border border-brand-border rounded-lg p-3 transition-all duration-150 hover:bg-surface-2 hover:scale-[1.02]">
                <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono mb-1.5">{s.label}</div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Recent repair orders */}
      <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
          <h2 className="text-sm font-bold text-text-primary">Recent Repair Orders</h2>
          <a href="/orders" className="text-xs text-teal hover:underline no-underline">View all</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="bg-surface-2">
                {['RO', 'Unit', 'Customer', 'Tech', 'Status', 'Priority'].map(h => (
                  <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentSOs ?? []).map(so => (
                <tr key={so.id} className="border-b border-brand-border/50 hover:bg-surface-2 cursor-pointer transition-colors duration-150"
                  onClick={() => window.location.href = `/orders/${so.id}`}>
                  <td className="px-3 py-2.5 font-mono text-xs text-teal font-bold">{so.so_number}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm font-semibold text-text-primary">#{(so.assets as any)?.unit_number ?? '?'}</span>
                    <span className="text-xs text-text-tertiary ml-2">{(so.assets as any)?.make} {(so.assets as any)?.model}</span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-text-secondary">{(so.customers as any)?.company_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-text-secondary">{(so.users as any)?.full_name ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold uppercase font-mono ${STATUS_COLOR[so.status] ?? 'text-text-tertiary'}`}>
                      {STATUS_LABEL[so.status] ?? so.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold uppercase font-mono ${so.priority === 'critical' ? 'text-error' : so.priority === 'high' ? 'text-warning' : 'text-text-tertiary'}`}>
                      {so.priority?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Check-ins */}
      {(checkins ?? []).length > 0 && (
        <div className="bg-surface border border-brand-border rounded-lg overflow-hidden mt-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
            <h2 className="text-sm font-bold text-text-primary">Recent Check-ins</h2>
            <a href="/kiosk" target="_blank" className="text-xs text-teal hover:underline no-underline">Open Kiosk</a>
          </div>
          {checkins.map((ci: any) => (
            <div key={ci.id} className="flex items-center justify-between px-4 py-3 border-b border-brand-border/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-teal/10 flex items-center justify-center">
                  <Truck size={16} strokeWidth={1.5} className="text-teal" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary">
                    {ci.company_name ?? (ci.customers as any)?.company_name ?? 'Walk-in'} &mdash; #{ci.unit_number}
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {ci.complaint_en ? (ci.complaint_en.length > 60 ? ci.complaint_en.slice(0, 60) + '...' : ci.complaint_en) : 'No description'}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-mono text-text-secondary">{new Date(ci.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                <div className="text-[9px] font-mono text-text-tertiary">{ci.checkin_ref}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
