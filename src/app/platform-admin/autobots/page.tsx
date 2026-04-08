'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Bot, Play, RotateCcw, Plus, Trash2, GripVertical, ChevronDown } from 'lucide-react'

const AVAILABLE_BOTS = [
  'AutoBot Service Writer',
  'AutoBot Mechanic',
  'AutoBot Parts',
  'AutoBot Accounting',
  'AutoBot Floor Supervisor',
]

const AVAILABLE_ACTIONS = [
  'check_in', 'create_wo', 'request_parts', 'fulfill_parts',
  'clock_in', 'complete_job', 'generate_invoice', 'close_invoice',
]

export default function AutoBotsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bots, setBots] = useState<any[]>([])
  const [scenarios, setScenarios] = useState<any[]>([])
  const [deploying, setDeploying] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [toast, setToast] = useState('')

  // Scenario builder state
  const [scenarioName, setScenarioName] = useState('')
  const [scenarioDesc, setScenarioDesc] = useState('')
  const [scenarioSteps, setScenarioSteps] = useState<{ bot: string; action: string; expected: string }[]>([
    { bot: AVAILABLE_BOTS[0], action: AVAILABLE_ACTIONS[0], expected: '' },
  ])
  const [savingScenario, setSavingScenario] = useState(false)

  // Run test state
  const [selectedScenario, setSelectedScenario] = useState('')
  const [targetShop, setTargetShop] = useState('')
  const [shops, setShops] = useState<any[]>([])
  const [running, setRunning] = useState(false)
  const [runProgress, setRunProgress] = useState<any>(null)
  const [runResult, setRunResult] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) return
      setUser(u)
      await fetchData(u.id)
      await fetchShops(u.id)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchData(userId: string) {
    const res = await fetch(`/api/platform-admin/autobots?user_id=${userId}`)
    if (res.ok) {
      const data = await res.json()
      setBots(data.bots || [])
      setScenarios(data.scenarios || [])
    }
  }

  async function fetchShops(userId: string) {
    const res = await fetch(`/api/platform-admin/shops?user_id=${userId}`)
    if (res.ok) {
      const data = await res.json()
      setShops(data || [])
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function deployAll() {
    if (!user) return
    setDeploying(true)
    try {
      const res = await fetch(`/api/platform-admin/autobots/deploy?user_id=${user.id}`, { method: 'POST' })
      const data = await res.json()
      const deployed = data.results?.filter((r: any) => r.status === 'deployed').length || 0
      showToast(`Deployed ${deployed} AutoBots successfully`)
      await fetchData(user.id)
    } catch {
      showToast('Failed to deploy AutoBots')
    }
    setDeploying(false)
  }

  async function resetAll() {
    if (!user) return
    setResetting(true)
    try {
      const res = await fetch(`/api/platform-admin/autobots/reset?user_id=${user.id}`, { method: 'POST' })
      if (res.ok) {
        showToast('All AutoBots reset successfully')
        await fetchData(user.id)
      } else {
        showToast('Failed to reset AutoBots')
      }
    } catch {
      showToast('Failed to reset AutoBots')
    }
    setResetting(false)
    setConfirmReset(false)
  }

  async function saveScenario() {
    if (!user || !scenarioName.trim()) return
    setSavingScenario(true)
    try {
      const res = await fetch('/api/platform-admin/autobots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: scenarioName,
          description: scenarioDesc,
          steps: scenarioSteps,
        }),
      })
      if (res.ok) {
        showToast('Scenario saved')
        setScenarioName('')
        setScenarioDesc('')
        setScenarioSteps([{ bot: AVAILABLE_BOTS[0], action: AVAILABLE_ACTIONS[0], expected: '' }])
        await fetchData(user.id)
      }
    } catch {
      showToast('Failed to save scenario')
    }
    setSavingScenario(false)
  }

  async function runTest() {
    if (!user || !selectedScenario) return
    setRunning(true)
    setRunResult(null)
    setRunProgress({ status: 'running', step: 0 })

    try {
      const res = await fetch('/api/platform-admin/autobots/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          scenario_id: selectedScenario,
          shop_id: targetShop,
        }),
      })
      const data = await res.json()
      setRunResult(data)
      setRunProgress(null)
    } catch {
      showToast('Test run failed')
      setRunProgress(null)
    }
    setRunning(false)
  }

  function addStep() {
    setScenarioSteps([...scenarioSteps, { bot: AVAILABLE_BOTS[0], action: AVAILABLE_ACTIONS[0], expected: '' }])
  }

  function removeStep(idx: number) {
    setScenarioSteps(scenarioSteps.filter((_, i) => i !== idx))
  }

  function updateStep(idx: number, field: string, value: string) {
    const copy = [...scenarioSteps]
    ;(copy[idx] as any)[field] = value
    setScenarioSteps(copy)
  }

  if (loading) return <div style={{ color: '#7C8BA0', fontSize: 13, padding: 40 }}>Loading...</div>

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', width: '100%',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle, appearance: 'none' as any, cursor: 'pointer',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%237C8BA0\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#1D6FE8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
          {toast}
        </div>
      )}

      {/* Confirm Reset Modal */}
      {confirmReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }} onClick={() => setConfirmReset(false)}>
          <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', margin: '0 0 12px' }}>Reset All AutoBots?</h3>
            <p style={{ fontSize: 12, color: '#7C8BA0', margin: '0 0 20px', lineHeight: 1.5 }}>
              This will delete all AutoBot auth accounts and user entries. AutoBots will need to be re-deployed after reset.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmReset(false)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#7C8BA0', cursor: 'pointer' }}>Cancel</button>
              <button onClick={resetAll} disabled={resetting} style={{ padding: '8px 16px', background: '#D94F4F', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: resetting ? 0.5 : 1 }}>
                {resetting ? 'Resetting...' : 'Reset All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: AutoBot Fleet */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF', margin: 0 }}>AutoBot Fleet</h1>
            <p style={{ fontSize: 12, color: '#7C8BA0', margin: '4px 0 0' }}>Automated test agents for TruckZen workflow verification</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirmReset(true)} disabled={resetting} style={{ padding: '8px 16px', background: 'rgba(217,79,79,.12)', border: '1px solid rgba(217,79,79,.3)', borderRadius: 8, fontSize: 12, color: '#D94F4F', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={13} /> Reset AutoBots
            </button>
            <button onClick={deployAll} disabled={deploying} style={{ padding: '8px 16px', background: '#1D6FE8', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: deploying ? 0.5 : 1 }}>
              <Bot size={13} /> {deploying ? 'Deploying...' : 'Deploy All AutoBots'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {bots.map(bot => (
            <div key={bot.id} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Bot size={16} color={bot.status === 'active' ? '#22C55E' : '#48536A'} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{bot.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#4D9EFF', background: 'rgba(29,111,232,.12)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {bot.role}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: bot.status === 'active' ? '#22C55E' : '#48536A',
                  background: bot.status === 'active' ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.04)',
                }}>
                  {bot.status === 'active' ? 'DEPLOYED' : 'NOT DEPLOYED'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace" }}>{bot.email}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Scenario Builder */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F0F4FF', margin: '0 0 16px' }}>Scenario Builder</h2>

        {/* Preset scenarios */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
          {scenarios.filter(s => s.is_preset).map(s => (
            <div key={s.id} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF', marginBottom: 6 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#7C8BA0', marginBottom: 10, lineHeight: 1.4 }}>{s.description}</div>
              <div style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace" }}>
                {(s.steps as any[]).length} steps
              </div>
            </div>
          ))}
        </div>

        {/* Custom saved scenarios */}
        {scenarios.filter(s => !s.is_preset).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#7C8BA0', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Custom Scenarios</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {scenarios.filter(s => !s.is_preset).map(s => (
                <div key={s.id} style={{ background: '#0D0F12', border: '1px solid rgba(29,111,232,.2)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF', marginBottom: 6 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#7C8BA0', marginBottom: 10, lineHeight: 1.4 }}>{s.description || 'No description'}</div>
                  <div style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {(s.steps as any[]).length} steps
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Builder form */}
        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF', margin: '0 0 16px' }}>Create Custom Scenario</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Scenario Name</label>
              <input value={scenarioName} onChange={e => setScenarioName(e.target.value)} placeholder="e.g. Night Shift Workflow" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Description</label>
              <input value={scenarioDesc} onChange={e => setScenarioDesc(e.target.value)} placeholder="Brief description of this scenario" style={inputStyle} />
            </div>
          </div>

          <label style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Steps</label>

          {scenarioSteps.map((step, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <GripVertical size={14} color="#48536A" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace", width: 20, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
              <select value={step.bot} onChange={e => updateStep(idx, 'bot', e.target.value)} style={{ ...selectStyle, width: 180 }}>
                {AVAILABLE_BOTS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={step.action} onChange={e => updateStep(idx, 'action', e.target.value)} style={{ ...selectStyle, width: 150 }}>
                {AVAILABLE_ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
              <input value={step.expected} onChange={e => updateStep(idx, 'expected', e.target.value)} placeholder="Expected result" style={{ ...inputStyle, flex: 1 }} />
              {scenarioSteps.length > 1 && (
                <button onClick={() => removeStep(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                  <Trash2 size={13} color="#D94F4F" />
                </button>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={addStep} style={{ padding: '6px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 11, color: '#7C8BA0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={12} /> Add Step
            </button>
            <button onClick={saveScenario} disabled={savingScenario || !scenarioName.trim()} style={{ padding: '6px 14px', background: '#1D6FE8', border: 'none', borderRadius: 8, fontSize: 11, color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: savingScenario || !scenarioName.trim() ? 0.5 : 1 }}>
              {savingScenario ? 'Saving...' : 'Save Scenario'}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: Run a Test */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F0F4FF', margin: '0 0 16px' }}>Run Test</h2>

        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Scenario</label>
              <select value={selectedScenario} onChange={e => setSelectedScenario(e.target.value)} style={selectStyle}>
                <option value="">Select a scenario...</option>
                {scenarios.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.is_preset ? '(preset)' : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Target Shop</label>
              <select value={targetShop} onChange={e => setTargetShop(e.target.value)} style={selectStyle}>
                {shops.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                {shops.length === 0 && <option value={targetShop}>UGL Truck Center</option>}
              </select>
            </div>
            <button onClick={runTest} disabled={running || !selectedScenario} style={{ padding: '10px 24px', background: '#1D6FE8', border: 'none', borderRadius: 8, fontSize: 13, color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: running || !selectedScenario ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <Play size={14} /> {running ? 'Running...' : 'Run AutoBots'}
            </button>
          </div>

          {/* Progress */}
          {running && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#1D6FE8', borderRadius: 2, width: '60%', animation: 'pulse 1.5s ease-in-out infinite', transition: 'width .3s' }} />
              </div>
              <div style={{ fontSize: 11, color: '#7C8BA0', marginTop: 6 }}>Running test steps...</div>
            </div>
          )}

          {/* Results */}
          {runResult && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: runResult.status === 'passed' ? '#22C55E' : '#D94F4F',
                  background: runResult.status === 'passed' ? 'rgba(34,197,94,.12)' : 'rgba(217,79,79,.12)',
                }}>
                  {runResult.status === 'passed' ? 'ALL PASSED' : 'HAS FAILURES'}
                </span>
                <span style={{ fontSize: 11, color: '#7C8BA0' }}>
                  {runResult.passed_steps}/{runResult.total_steps} passed | {runResult.duration_ms}ms
                </span>
              </div>

              {/* Step details */}
              {runResult.steps_detail?.map((step: any) => (
                <div key={step.index} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: step.status === 'passed' ? '#22C55E' : '#D94F4F',
                  }} />
                  <span style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace", width: 24, flexShrink: 0 }}>#{step.index}</span>
                  <span style={{ fontSize: 11, color: '#7C8BA0', width: 160, flexShrink: 0 }}>{step.bot}</span>
                  <span style={{ fontSize: 10, color: '#4D9EFF', fontFamily: "'IBM Plex Mono', monospace", width: 120, flexShrink: 0 }}>{step.action}</span>
                  <span style={{ fontSize: 11, color: step.status === 'passed' ? '#7C8BA0' : '#D94F4F', flex: 1 }}>{step.log}</span>
                  <span style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace" }}>{step.duration_ms}ms</span>
                </div>
              ))}

              <div style={{ marginTop: 16 }}>
                <a href="/platform-admin/test-results" style={{ padding: '8px 16px', background: 'rgba(29,111,232,.12)', border: '1px solid rgba(29,111,232,.3)', borderRadius: 8, fontSize: 12, color: '#4D9EFF', fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>
                  View Full Report
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>
    </div>
  )
}
