'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Plus, Loader2 } from 'lucide-react'

export default function DriversPage() {
  const supabase = createClient()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      const res = await fetch(`/api/drivers?shop_id=${p.shop_id}`)
      setDrivers((await res.json()) ?? []); setLoading(false)
    })
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const expCls = (d?: string) => !d ? 'text-text-tertiary' : d < today ? 'text-error' : d <= in30 ? 'text-warning' : 'text-success'
  const expLbl = (d?: string) => !d ? '' : d < today ? 'Expired' : d <= in30 ? 'Expiring' : ''

  const filtered = (drivers ?? []).filter(d => !search || d.full_name?.toLowerCase().includes(search.toLowerCase()) || d.cdl_number?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal" /></div>

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
          <p className="text-sm text-text-secondary">{filtered.length} drivers</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, CDL..."
            className="px-3 py-2 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors w-52" />
          <a href="/drivers/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors no-underline">
            <Plus size={14} strokeWidth={2} /> Add Driver
          </a>
        </div>
      </div>
      <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className="bg-surface-2">
              {['Name', 'Phone', 'CDL', 'Class', 'CDL Expiry', 'Medical Expiry', 'Status'].map(h =>
                <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7} className="text-center text-text-secondary py-12 text-sm">No drivers yet</td></tr>
              : filtered.map(d => (
                <tr key={d.id} className={`border-b border-brand-border/50 hover:bg-surface-2 cursor-pointer transition-colors ${d.active === false ? 'opacity-50' : ''}`}
                  onClick={() => window.location.href = `/drivers/${d.id}`}>
                  <td className="px-3 py-2.5 text-sm font-semibold text-text-primary">{d.full_name}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{d.phone ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-teal">{d.cdl_number ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{d.cdl_class ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`font-mono text-xs font-bold ${expCls(d.cdl_expiry)}`}>{d.cdl_expiry ?? '—'}</span>
                    {expLbl(d.cdl_expiry) && <div className={`text-[9px] font-mono ${expCls(d.cdl_expiry)}`}>{expLbl(d.cdl_expiry)}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`font-mono text-xs font-bold ${expCls(d.medical_expiry)}`}>{d.medical_expiry ?? '—'}</span>
                    {expLbl(d.medical_expiry) && <div className={`text-[9px] font-mono ${expCls(d.medical_expiry)}`}>{expLbl(d.medical_expiry)}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold uppercase ${d.active !== false ? 'text-success' : 'text-text-tertiary'}`}>{d.active !== false ? 'Active' : 'Inactive'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
