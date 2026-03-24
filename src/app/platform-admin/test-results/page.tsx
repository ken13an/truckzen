'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { BarChart3, Clock, CheckCircle, Activity, X, Play } from 'lucide-react'

export default function TestResultsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedResult, setSelectedResult] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) return
      setUser(u)
      await fetchResults(u.id, 1)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchResults(userId: string, p: number) {
    const res = await fetch(`/api/platform-admin/autobots/results?user_id=${userId}&page=${p}&limit=20`)
    if (res.ok) {
      const data = await res.json()
      setResults(data.results || [])
      setSummary(data.summary || {})
      setPage(data.page)
      setPages(data.pages)
      setTotal(data.total)
    }
  }

  function fmtTime(d: string) {
    if (!d) return '--'
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function fmtDuration(ms: number | null) {
    if (!ms) return '--'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (loading) return <div style={{ color: '#7C8BA0', fontSize: 13, padding: 40 }}>Loading...</div>

  return (
    <div>
      {/* Report Modal */}
      {selectedResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }} onClick={() => setSelectedResult(null)}>
          <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 24, maxWidth: 700, width: '95%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', margin: 0 }}>
                Test Report: {selectedResult.scenario_name}
              </h3>
              <button onClick={() => setSelectedResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} color="#7C8BA0" />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                fontFamily: "'IBM Plex Mono', monospace",
                color: selectedResult.status === 'passed' ? '#22C55E' : selectedResult.status === 'running' ? '#1D6FE8' : '#D94F4F',
                background: selectedResult.status === 'passed' ? 'rgba(34,197,94,.12)' : selectedResult.status === 'running' ? 'rgba(29,111,232,.12)' : 'rgba(217,79,79,.12)',
              }}>
                {selectedResult.status === 'passed' ? 'ALL PASSED' : selectedResult.status === 'running' ? 'RUNNING' : 'HAS FAILURES'}
              </span>
              <span style={{ fontSize: 11, color: '#7C8BA0' }}>
                {selectedResult.passed_steps}/{selectedResult.total_steps} passed | {fmtDuration(selectedResult.duration_ms)}
              </span>
              <span style={{ fontSize: 11, color: '#48536A' }}>{fmtTime(selectedResult.started_at)}</span>
            </div>

            {/* Steps */}
            <div style={{ background: 'rgba(255,255,255,.02)', borderRadius: 8, overflow: 'hidden' }}>
              {(selectedResult.steps_detail as any[] || []).map((step: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: step.status === 'passed' ? '#22C55E' : '#D94F4F',
                  }} />
                  <span style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace", width: 24, flexShrink: 0 }}>#{step.index}</span>
                  <span style={{ fontSize: 11, color: '#DDE3EE', fontWeight: 600, width: 150, flexShrink: 0 }}>{step.bot}</span>
                  <span style={{ fontSize: 10, color: '#4D9EFF', fontFamily: "'IBM Plex Mono', monospace", width: 110, flexShrink: 0 }}>{step.action}</span>
                  <span style={{ fontSize: 11, color: step.status === 'passed' ? '#7C8BA0' : '#D94F4F', flex: 1 }}>{step.log}</span>
                  <span style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace" }}>{step.duration_ms}ms</span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(255,255,255,.02)', borderRadius: 8, display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Steps</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', fontFamily: "'IBM Plex Mono', monospace" }}>{selectedResult.total_steps}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Passed</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#22C55E', fontFamily: "'IBM Plex Mono', monospace" }}>{selectedResult.passed_steps}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Failed</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#D94F4F', fontFamily: "'IBM Plex Mono', monospace" }}>{selectedResult.failed_steps}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDuration(selectedResult.duration_ms)}</div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <a href="/platform-admin/autobots" style={{ padding: '8px 16px', background: 'rgba(29,111,232,.12)', border: '1px solid rgba(29,111,232,.3)', borderRadius: 8, fontSize: 12, color: '#4D9EFF', fontWeight: 600, textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Play size={12} /> Re-run this scenario
              </a>
            </div>
          </div>
        </div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF', margin: '0 0 4px' }}>Test Results</h1>
      <p style={{ fontSize: 12, color: '#7C8BA0', margin: '0 0 24px' }}>History of all AutoBot test runs</p>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Runs', value: summary.total_runs || 0, icon: BarChart3, color: '#4D9EFF' },
          { label: 'Pass Rate', value: `${summary.pass_rate || 0}%`, icon: CheckCircle, color: '#22C55E' },
          { label: 'Last Run', value: summary.last_run ? fmtTime(summary.last_run) : '--', icon: Clock, color: '#F59E0B' },
          { label: 'Avg Duration', value: fmtDuration(summary.avg_duration || 0), icon: Activity, color: '#8B5CF6' },
        ].map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Icon size={14} color={card.color} />
                <span style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#F0F4FF', fontFamily: "'IBM Plex Mono', monospace" }}>{card.value}</div>
            </div>
          )
        })}
      </div>

      {/* Results Table */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Run #', 'Scenario', 'Date', 'Duration', 'Steps', 'Passed', 'Failed', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", borderBottom: '1px solid rgba(255,255,255,.06)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r, idx) => (
              <tr key={r.id}>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#48536A', borderBottom: '1px solid rgba(255,255,255,.04)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  #{total - ((page - 1) * 20 + idx)}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#DDE3EE', borderBottom: '1px solid rgba(255,255,255,.04)', fontWeight: 500 }}>{r.scenario_name}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#48536A', borderBottom: '1px solid rgba(255,255,255,.04)', fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap' }}>{fmtTime(r.started_at)}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#7C8BA0', borderBottom: '1px solid rgba(255,255,255,.04)', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDuration(r.duration_ms)}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#7C8BA0', borderBottom: '1px solid rgba(255,255,255,.04)', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center' }}>{r.total_steps}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#22C55E', borderBottom: '1px solid rgba(255,255,255,.04)', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center' }}>{r.passed_steps}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: r.failed_steps > 0 ? '#D94F4F' : '#48536A', borderBottom: '1px solid rgba(255,255,255,.04)', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center' }}>{r.failed_steps}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                    fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase',
                    color: r.status === 'passed' ? '#22C55E' : r.status === 'running' ? '#1D6FE8' : '#D94F4F',
                    background: r.status === 'passed' ? 'rgba(34,197,94,.12)' : r.status === 'running' ? 'rgba(29,111,232,.12)' : 'rgba(217,79,79,.12)',
                  }}>
                    {r.status === 'passed' ? 'All Pass' : r.status === 'running' ? 'Running' : 'Has Failures'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <button onClick={() => setSelectedResult(r)} style={{ padding: '4px 10px', background: 'rgba(29,111,232,.12)', border: '1px solid rgba(29,111,232,.3)', borderRadius: 6, fontSize: 10, color: '#4D9EFF', fontWeight: 600, cursor: 'pointer' }}>
                    View Report
                  </button>
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#48536A', fontSize: 12 }}>No test results yet. Run a test from the AutoBots page.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => { setPage(p); if (user) fetchResults(user.id, p) }}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace", border: 'none',
                background: p === page ? '#1D6FE8' : 'rgba(255,255,255,.06)',
                color: p === page ? '#fff' : '#7C8BA0',
                fontWeight: p === page ? 700 : 400,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
