'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Loader2 } from 'lucide-react'

export default function TimeTrackingPage() {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('7')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      const from = new Date(Date.now() - parseInt(range) * 86400000).toISOString().split('T')[0]
      const to = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/time-tracking?from=${from}&to=${to}`)
      setData(await res.json()); setLoading(false)
    })
  }, [range])

  const fmtMin = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal" /></div>

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time Clock</h1>
          <p className="text-sm text-text-secondary">{data ? `${data.total_hours ?? 0}h total · ${(data.by_tech ?? []).length} technicians` : 'No data'}</p>
        </div>
        <div className="flex gap-1.5">
          {[['7', '7 days'], ['14', '14 days'], ['30', '30 days']].map(([v, l]) => (
            <button key={v} onClick={() => setRange(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${range === v ? 'bg-teal/10 text-teal border border-teal/30' : 'bg-surface-2 text-text-tertiary border border-brand-border hover:text-text-secondary'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {!(data?.by_tech ?? []).length ? (
        <div className="bg-surface border border-brand-border rounded-lg p-12 text-center text-text-secondary text-sm">No time entries in this period</div>
      ) : (data.by_tech ?? []).map((tech: any) => (
        <div key={tech.id} className="bg-surface border border-brand-border rounded-lg p-4 mb-3">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <div className="text-sm font-bold text-text-primary">{tech.name}</div>
              {tech.team && <div className="text-[10px] text-text-secondary">Team {tech.team}</div>}
            </div>
            <div className="text-2xl font-bold text-teal">{fmtMin(tech.total_minutes)}</div>
          </div>
          <div className="h-1 bg-surface-2 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-teal rounded-full transition-all duration-300" style={{ width: `${Math.min(100, tech.total_minutes / ((data.total_minutes ?? 1) / (data.by_tech ?? []).length) * 50)}%` }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead><tr className="bg-surface-2">
                {['Date', 'RO', 'Unit', 'Customer', 'Time'].map(h => <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-2.5 py-1.5 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {(tech.entries ?? []).map((e: any, i: number) => (
                  <tr key={i} className="border-b border-brand-border/50">
                    <td className="px-2.5 py-2 font-mono text-[10px] text-text-tertiary">{e.date}</td>
                    <td className="px-2.5 py-2 font-mono text-[10px] text-teal">{e.so_number ?? '—'}</td>
                    <td className="px-2.5 py-2 text-xs text-text-primary">{e.truck ?? '—'}</td>
                    <td className="px-2.5 py-2 text-xs text-text-secondary">{e.customer ?? '—'}</td>
                    <td className="px-2.5 py-2 font-mono text-xs font-bold text-success">{fmtMin(e.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
