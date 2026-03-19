'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Loader2, Plus } from 'lucide-react'

const STATUS_CLS: Record<string, string> = {
  on_road: 'text-success bg-success/15', in_shop: 'text-teal bg-teal/15',
  out_of_service: 'text-error bg-error/15', retired: 'text-text-tertiary bg-text-tertiary/15',
}

export default function FleetPage() {
  const supabase = createClient()
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      const res = await fetch(`/api/assets?shop_id=${profile.shop_id}`)
      if (res.ok) { const data = await res.json(); setAssets(Array.isArray(data) ? data : []) }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = (assets ?? []).filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.unit_number?.toLowerCase().includes(q) || a.make?.toLowerCase().includes(q) || (a.customers as any)?.company_name?.toLowerCase().includes(q)
  })

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal" /></div>

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Fleet</h1>
          <p className="text-sm text-text-secondary">{filtered.length} vehicles</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit, make, customer..."
            className="px-3 py-2 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors duration-150 w-56" />
          <a href="/fleet/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors duration-150 no-underline">
            <Plus size={14} strokeWidth={2} /> Add Vehicle
          </a>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 mb-4">
        {[
          { href: '/fleet', label: 'Vehicles', active: true },
          { href: '/drivers', label: 'Drivers', active: false },
          { href: '/dvir', label: 'DVIR', active: false },
          { href: '/maintenance', label: 'Maintenance', active: false },
          { href: '/fleet/compliance', label: 'Compliance', active: false },
        ].map(t => (
          <a key={t.href} href={t.href}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold no-underline transition-colors duration-150 ${t.active ? 'bg-teal/10 text-teal' : 'text-text-tertiary hover:text-text-secondary'}`}>
            {t.label}
          </a>
        ))}
      </div>

      <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr className="bg-surface-2">
              {['Unit', 'Year', 'Make / Model', 'VIN', 'Odometer', 'Owner', 'Status'].map(h =>
                <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-text-secondary py-12 text-sm">No vehicles found</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="border-b border-brand-border/50 hover:bg-surface-2 cursor-pointer transition-colors duration-150" onClick={() => window.location.href = '/fleet/' + a.id}>
                  <td className="px-3 py-2.5 font-mono text-xs text-teal font-bold">{a.unit_number}</td>
                  <td className="px-3 py-2.5 text-sm text-text-secondary">{a.year}</td>
                  <td className="px-3 py-2.5 text-sm font-semibold text-text-primary">{a.make} {a.model}</td>
                  <td className="px-3 py-2.5 font-mono text-[10px] text-text-tertiary">{a.vin ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-sm text-text-primary">{a.odometer?.toLocaleString() ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-text-secondary">{(a.customers as any)?.company_name ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${STATUS_CLS[a.status] ?? 'text-text-tertiary bg-text-tertiary/15'}`}>
                      {(a.status ?? 'on_road').replace(/_/g, ' ')}
                    </span>
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
