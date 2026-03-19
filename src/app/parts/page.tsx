'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Plus, Loader2 } from 'lucide-react'

export default function PartsPage() {
  const supabase = createClient()
  const [parts, setParts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      const { data } = await supabase.from('parts')
        .select('id, part_number, description, category, on_hand, reorder_point, cost_price, sell_price, vendor, bin_location')
        .eq('shop_id', p.shop_id).order('description')
      setParts(data ?? []); setLoading(false)
    })
  }, [])

  const filtered = (parts ?? []).filter(p => !search || p.description?.toLowerCase().includes(search.toLowerCase()) || p.part_number?.toLowerCase().includes(search.toLowerCase()))
  const margin = (p: any) => p.sell_price && p.cost_price ? Math.round((p.sell_price - p.cost_price) / p.sell_price * 100) : 0
  const lowCount = parts.filter(p => p.on_hand <= p.reorder_point).length

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal" /></div>

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parts Inventory</h1>
          <p className="text-sm text-text-secondary">{filtered.length} parts &middot; {lowCount} low stock</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search part or description..."
            className="px-3 py-2 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors w-52" />
          <a href="/parts/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors no-underline"><Plus size={14} strokeWidth={2} /> Add Part</a>
          <a href="/parts/reorder" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface-2 border border-brand-border text-text-secondary rounded-md text-sm font-semibold hover:text-text-primary transition-colors no-underline">Reorder</a>
        </div>
      </div>
      <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead><tr className="bg-surface-2">
              {['Part #', 'Description', 'Category', 'On Hand', 'Reorder', 'Cost', 'Sell', 'Margin', 'Bin', 'Status'].map(h =>
                <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={10} className="text-center text-text-secondary py-12 text-sm">No parts found</td></tr>
              : filtered.map(p => {
                const isOut = p.on_hand === 0; const isLow = p.on_hand <= p.reorder_point && !isOut; const m = margin(p)
                return (
                  <tr key={p.id} className="border-b border-brand-border/50 hover:bg-surface-2 cursor-pointer transition-colors" onClick={() => window.location.href = '/parts/' + p.id}>
                    <td className="px-3 py-2.5 font-mono text-xs text-teal">{p.part_number}</td>
                    <td className="px-3 py-2.5 text-sm text-text-primary max-w-[200px] truncate">{p.description}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">{p.category}</td>
                    <td className={`px-3 py-2.5 font-mono text-sm font-bold text-center ${isOut ? 'text-error' : isLow ? 'text-warning' : 'text-text-primary'}`}>{p.on_hand}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-tertiary text-center">{p.reorder_point}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">${(p.cost_price ?? 0).toFixed(0)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-primary">${(p.sell_price ?? 0).toFixed(0)}</td>
                    <td className={`px-3 py-2.5 font-mono text-xs font-bold ${m >= 40 ? 'text-success' : m >= 25 ? 'text-warning' : 'text-error'}`}>{m}%</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-tertiary">{p.bin_location ?? ''}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${isOut ? 'text-error bg-error/15' : isLow ? 'text-warning bg-warning/15' : 'text-success bg-success/15'}`}>
                        {isOut ? 'Out' : isLow ? 'Low' : 'In Stock'}
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
