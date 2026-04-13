/**
 * TruckZen — Original Design
 * Bulk skill assignment for mechanic onboarding
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { SKILL_CATALOG, SKILL_TEMPLATES } from '@/lib/mechanic-skills'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#4D9EFF', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

const LEVEL_COLORS: Record<string, string> = { beginner: '#7C8BA0', intermediate: '#4D9EFF', experienced: '#D4882A', expert: '#1DB870' }

export default function BulkSkillsPage() {
  const { tokens: th } = useTheme()

  const btnP: React.CSSProperties = { padding: '8px 16px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }
  const btnS: React.CSSProperties = { padding: '6px 12px', background: 'transparent', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, color: 'var(--tz-textSecondary)', fontSize: 11, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }
  const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, fontSize: 12, color: 'var(--tz-text)', outline: 'none', fontFamily: "'Instrument Sans',sans-serif" }
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [mechanics, setMechanics] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalCategory, setModalCategory] = useState('')
  const [modalSkills, setModalSkills] = useState<Set<string>>(new Set())
  const [modalLevel, setModalLevel] = useState('intermediate')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      const [usersRes, sk] = await Promise.all([
        fetch(`/api/users?shop_id=${p.shop_id}`).then(r => r.json()),
        fetch(`/api/mechanic-skills?shop_id=${p.shop_id}&type=list`).then(r => r.json()),
      ])
      const mechs = Array.isArray(usersRes)
        ? usersRes.filter((u: any) => ['technician', 'lead_tech', 'maintenance_technician'].includes(u.role) && u.active && !u.deleted_at)
        : []
      setMechanics(mechs)
      setSkills(Array.isArray(sk) ? sk : [])
      setLoading(false)
    })
  }, [])

  function getSkillCount(userId: string) { return skills.filter(s => s.user_id === userId).length }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function selectAll() { setSelected(new Set(mechanics.map(m => m.id))) }
  function selectNone() { setSelected(new Set()) }

  async function assignSkills() {
    if (!user || selected.size === 0 || modalSkills.size === 0) return
    setSaving(true)
    const skillList = Array.from(modalSkills).map(name => {
      const cat = Object.entries(SKILL_CATALOG).find(([, skills]) => skills.includes(name))?.[0] || 'Specialty'
      return { name, category: cat, level: modalLevel, certified: false }
    })
    const res = await fetch('/api/mechanic-skills', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_add', shop_id: user.shop_id, skills: skillList, user_ids: Array.from(selected) }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      flash(`Added ${data.count} skills`)
      setShowModal(false); setModalSkills(new Set()); setModalCategory('')
      // Reload skills
      const sk = await fetch(`/api/mechanic-skills?shop_id=${user.shop_id}&type=list`).then(r => r.json())
      setSkills(Array.isArray(sk) ? sk : [])
    } else flash('Failed to save')
  }

  async function applyTemplate(templateName: string) {
    if (!user || selected.size === 0) return
    const template = SKILL_TEMPLATES[templateName]
    if (!template) return
    setSaving(true)
    const res = await fetch('/api/mechanic-skills', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_add', shop_id: user.shop_id, skills: template.skills, user_ids: Array.from(selected) }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      flash(`Applied "${templateName}" — ${data.count} skills`)
      const sk = await fetch(`/api/mechanic-skills?shop_id=${user.shop_id}&type=list`).then(r => r.json())
      setSkills(Array.isArray(sk) ? sk : [])
    } else flash('Failed')
  }

  if (loading) return <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24 }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: 'var(--tz-accent)', color: 'var(--tz-bgLight)', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)', marginBottom: 4 }}>Bulk Skills Assignment</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Select mechanics and assign skills in bulk for onboarding</div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={selectAll} style={btnS}>Select All ({mechanics.length})</button>
        <button onClick={selectNone} style={btnS}>Select None</button>
        <span style={{ fontSize: 11, color: MUTED }}>{selected.size} selected</span>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && (
          <>
            <button onClick={() => { setShowModal(true); setModalCategory(''); setModalSkills(new Set()) }} style={btnP}>Assign Skills to Selected</button>
            <div style={{ position: 'relative' }}>
              <select onChange={e => { if (e.target.value) applyTemplate(e.target.value); e.target.value = '' }} style={{ ...btnS, appearance: 'auto', paddingRight: 24 }} disabled={saving}>
                <option value="">Apply Template...</option>
                {Object.keys(SKILL_TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Mechanics table */}
      <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['', 'Name', 'Role', 'Team', 'Skills', 'Top Category'].map(h =>
              <th key={h} style={{ fontFamily: MONO, fontSize: 8, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '8px 10px', textAlign: 'left', background: 'var(--tz-bgInput)' }}>{h}</th>
            )}
          </tr></thead>
          <tbody>
            {mechanics.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>No mechanics found. Add team members in Settings → Team first.</td></tr>
            ) : mechanics.map(m => {
              const mechSkills = skills.filter(s => s.user_id === m.id)
              const topCat = mechSkills.length > 0
                ? Object.entries(mechSkills.reduce((acc: Record<string, number>, s: any) => { acc[s.skill_category] = (acc[s.skill_category] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
                : '—'
              return (
                <tr key={m.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}`, cursor: 'pointer' }} onClick={() => toggleSelect(m.id)}>
                  <td style={{ padding: '10px 10px', width: 30 }}>
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--tz-accent)' }} />
                  </td>
                  <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--tz-text)', fontSize: 13 }}>{m.full_name}</td>
                  <td style={{ padding: '10px 10px', fontSize: 11, color: MUTED }}>{m.role?.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '10px 10px', fontSize: 11, color: MUTED }}>{m.team || '—'}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: mechSkills.length > 0 ? BLUE : 'var(--tz-textTertiary)' }}>{mechSkills.length}</span>
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 11, color: MUTED }}>{topCat}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Skill Templates */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 12 }}>Quick Templates</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {Object.entries(SKILL_TEMPLATES).map(([name, tmpl]) => (
            <div key={name} style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 8 }}>{tmpl.skills.length} skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                {tmpl.skills.slice(0, 4).map(s => (
                  <span key={s.name} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: `${LEVEL_COLORS[s.level]}18`, color: LEVEL_COLORS[s.level] }}>{s.name.slice(0, 20)}</span>
                ))}
                {tmpl.skills.length > 4 && <span style={{ fontSize: 8, color: 'var(--tz-textTertiary)' }}>+{tmpl.skills.length - 4} more</span>}
              </div>
              <button onClick={() => { if (selected.size === 0) flash('Select mechanics first'); else applyTemplate(name) }} disabled={saving || selected.size === 0}
                style={{ ...btnS, fontSize: 10, padding: '4px 10px', opacity: selected.size > 0 ? 1 : 0.4 }}>
                Apply to {selected.size} selected
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Assign Skills */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#12131a', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 16, padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 16 }}>Assign Skills to {selected.size} Mechanic{selected.size !== 1 ? 's' : ''}</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>Category</div>
              <select value={modalCategory} onChange={e => { setModalCategory(e.target.value); setModalSkills(new Set()) }} style={selectStyle}>
                <option value="">Select category...</option>
                {Object.keys(SKILL_CATALOG).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {modalCategory && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase' }}>Skills</div>
                    <button onClick={() => setModalSkills(new Set(SKILL_CATALOG[modalCategory]))} style={{ fontSize: 9, color: BLUE, background: 'none', border: 'none', cursor: 'pointer' }}>Select All</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {SKILL_CATALOG[modalCategory].map(skill => (
                      <label key={skill} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--tz-text)', cursor: 'pointer', padding: '4px 0' }}>
                        <input type="checkbox" checked={modalSkills.has(skill)} onChange={() => { const n = new Set(modalSkills); n.has(skill) ? n.delete(skill) : n.add(skill); setModalSkills(n) }} style={{ accentColor: 'var(--tz-accent)' }} />
                        {skill}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>Experience Level</div>
                  <select value={modalLevel} onChange={e => setModalLevel(e.target.value)} style={selectStyle}>
                    {['beginner', 'intermediate', 'experienced', 'expert'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                <button onClick={assignSkills} disabled={saving || modalSkills.size === 0} style={{ ...btnP, width: '100%', opacity: modalSkills.size > 0 ? 1 : 0.5 }}>
                  {saving ? 'Saving...' : `Add ${modalSkills.size} Skill${modalSkills.size !== 1 ? 's' : ''} to ${selected.size} Mechanic${selected.size !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

