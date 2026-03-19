'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Loader2 } from 'lucide-react'

export default function AccountingPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!['owner', 'gm', 'it_person', 'accountant', 'office_admin'].includes(p.role)) { window.location.href = '/dashboard'; return }
      const [{ data: invData }, { data: allInv }] = await Promise.all([
        supabase.from('invoices').select('status, total, balance_due, due_date').eq('shop_id', p.shop_id),
        supabase.from('invoices').select('id, invoice_number, status, total, balance_due, due_date, customers(company_name)').eq('shop_id', p.shop_id).order('created_at', { ascending: false }).limit(20),
      ])
      const today = new Date().toISOString().split('T')[0]
      const paid = (invData ?? []).filter((i: any) => i.status === 'paid')
      const sent = (invData ?? []).filter((i: any) => i.status === 'sent')
      setStats({
        revenue_mtd: paid.reduce((s: number, i: any) => s + (i.total ?? 0), 0),
        outstanding: sent.reduce((s: number, i: any) => s + (i.balance_due ?? 0), 0),
        overdue: sent.filter((i: any) => i.due_date && i.due_date < today).reduce((s: number, i: any) => s + (i.balance_due ?? 0), 0),
        invoice_count: (invData ?? []).length,
      })
      setInvoices(allInv ?? []); setLoading(false)
    })
  }, [])

  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal" /></div>

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      <h1 className="text-2xl font-bold tracking-tight mb-5">Accounting</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {[
          { label: 'Revenue MTD', value: fmt(stats?.revenue_mtd ?? 0), cls: 'text-text-primary' },
          { label: 'Outstanding', value: fmt(stats?.outstanding ?? 0), cls: (stats?.outstanding ?? 0) > 0 ? 'text-warning' : 'text-success' },
          { label: 'Overdue', value: fmt(stats?.overdue ?? 0), cls: (stats?.overdue ?? 0) > 0 ? 'text-error' : 'text-success' },
          { label: 'Invoices', value: String(stats?.invoice_count ?? 0), cls: 'text-text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-brand-border rounded-lg p-3">
            <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono mb-1.5">{s.label}</div>
            <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button className="px-3.5 py-2 bg-teal/10 border border-teal/25 text-teal rounded-md text-xs font-bold hover:bg-teal/20 transition-colors">Sync to QuickBooks</button>
        <button className="px-3.5 py-2 bg-surface-2 border border-brand-border text-text-secondary rounded-md text-xs font-semibold hover:text-text-primary transition-colors">Export CSV</button>
      </div>

      <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead><tr className="bg-surface-2">
              {['Invoice', 'Customer', 'Total', 'Balance', 'Due Date', 'Status'].map(h =>
                <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {(invoices ?? []).map(inv => {
                const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < today
                return (
                  <tr key={inv.id} className="border-b border-brand-border/50 hover:bg-surface-2 cursor-pointer transition-colors" onClick={() => window.location.href = '/invoices/' + inv.id}>
                    <td className="px-3 py-2.5 font-mono text-xs text-teal font-bold">{inv.invoice_number}</td>
                    <td className="px-3 py-2.5 text-sm text-text-primary">{(inv.customers as any)?.company_name ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-sm font-bold text-text-primary">{fmt(inv.total ?? 0)}</td>
                    <td className={`px-3 py-2.5 font-mono text-sm font-bold ${(inv.balance_due ?? 0) > 0 ? 'text-teal' : 'text-success'}`}>{fmt(inv.balance_due ?? 0)}</td>
                    <td className={`px-3 py-2.5 text-sm ${isOverdue ? 'text-error' : 'text-text-secondary'}`}>{inv.due_date ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${isOverdue ? 'text-error bg-error/15' : inv.status === 'paid' ? 'text-success bg-success/15' : inv.status === 'sent' ? 'text-teal bg-teal/15' : 'text-text-tertiary bg-text-tertiary/15'}`}>
                        {isOverdue ? 'Overdue' : inv.status === 'paid' ? 'Paid' : inv.status === 'sent' ? 'Sent' : inv.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
