'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Plus, Loader2 } from 'lucide-react'

const STATUS_CLS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'text-text-tertiary bg-text-tertiary/15' },
  sent: { label: 'Sent', cls: 'text-teal bg-teal/15' },
  paid: { label: 'Paid', cls: 'text-success bg-success/15' },
  overdue: { label: 'Overdue', cls: 'text-error bg-error/15' },
  voided: { label: 'Voided', cls: 'text-text-tertiary bg-text-tertiary/15' },
}

export default function InvoicesPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      let q = supabase.from('invoices')
        .select('id, invoice_number, status, total, balance_due, amount_paid, due_date, customers(company_name), service_orders(so_number, assets(unit_number))')
        .eq('shop_id', p.shop_id).order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('status', filter)
      const { data } = await q.limit(100)
      setInvoices(data ?? []); setLoading(false)
    })
  }, [filter])

  const outstanding = (invoices ?? []).filter(i => i.status === 'sent').reduce((s: number, i: any) => s + (i.balance_due ?? 0), 0)
  const paidMTD = (invoices ?? []).filter(i => i.status === 'paid').reduce((s: number, i: any) => s + (i.total ?? 0), 0)
  const today = new Date().toISOString().split('T')[0]

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal" /></div>

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-text-secondary">Outstanding: ${outstanding.toFixed(0)} &middot; Paid MTD: ${paidMTD.toFixed(0)}</p>
        </div>
        <a href="/invoices/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors no-underline">
          <Plus size={14} strokeWidth={2} /> New Invoice
        </a>
      </div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === s ? 'bg-teal/10 text-teal border border-teal/30' : 'bg-surface-2 text-text-tertiary border border-brand-border hover:text-text-secondary'}`}>
            {s === 'all' ? 'All' : STATUS_CLS[s]?.label ?? s}
          </button>
        ))}
      </div>
      <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr className="bg-surface-2">
              {['Invoice', 'Customer', 'RO / Unit', 'Total', 'Balance', 'Due Date', 'Status'].map(h =>
                <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {invoices.length === 0 ? <tr><td colSpan={7} className="text-center text-text-secondary py-12 text-sm">No invoices</td></tr>
              : invoices.map(inv => {
                const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < today
                const st = isOverdue ? STATUS_CLS.overdue : (STATUS_CLS[inv.status] ?? STATUS_CLS.draft)
                return (
                  <tr key={inv.id} className="border-b border-brand-border/50 hover:bg-surface-2 cursor-pointer transition-colors" onClick={() => window.location.href = '/invoices/' + inv.id}>
                    <td className="px-3 py-2.5 font-mono text-xs text-teal font-bold">{inv.invoice_number}</td>
                    <td className="px-3 py-2.5 text-sm text-text-primary">{(inv.customers as any)?.company_name ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{(inv.service_orders as any)?.so_number ?? ''}{(inv.service_orders as any)?.assets?.unit_number ? ` #${(inv.service_orders as any).assets.unit_number}` : ''}</td>
                    <td className="px-3 py-2.5 font-mono text-sm font-bold text-text-primary">${(inv.total ?? 0).toFixed(2)}</td>
                    <td className={`px-3 py-2.5 font-mono text-sm font-bold ${(inv.balance_due ?? 0) > 0 ? 'text-teal' : 'text-success'}`}>${(inv.balance_due ?? 0).toFixed(2)}</td>
                    <td className={`px-3 py-2.5 text-sm ${isOverdue ? 'text-error' : 'text-text-secondary'}`}>{inv.due_date ?? '—'}</td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${st.cls}`}>{st.label}</span></td>
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
