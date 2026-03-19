'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const OFFICE_ROLES = ['service_writer', 'accountant', 'office_admin', 'shop_manager', 'gm', 'dispatcher']
const FLOOR_ROLES = ['technician', 'maintenance_technician', 'maintenance_manager']
const OTHER_ROLES = ['parts_manager', 'fleet_manager', 'driver']

export default function NewUserPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', email: '', role: 'technician', department: 'floor' as 'floor' | 'office' | 'parts' | 'fleet', team: 'A', language: 'en' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Auto-set department when role changes
  function setRole(role: string) {
    let dept: typeof form.department = 'floor'
    if (OFFICE_ROLES.includes(role)) dept = 'office'
    else if (role === 'parts_manager') dept = 'parts'
    else if (role === 'fleet_manager' || role === 'driver') dept = 'fleet'
    setForm(f => ({ ...f, role, department: dept, team: dept === 'floor' ? f.team || 'A' : '' }))
  }

  const needsTeam = form.department === 'floor'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name || !form.email) { setError('Name and email required'); return }
    setSaving(true); setError('')
    const payload = { full_name: form.full_name, email: form.email, role: form.role, team: needsTeam ? form.team : null, language: form.language }
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to invite staff member'); setSaving(false); return }
    setDone(true)
  }

  if (done) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: '#F0F4FF', marginBottom: 8 }}>Invite Sent</div>
        <div style={{ fontSize: 13, color: '#7C8BA0', lineHeight: 1.6, marginBottom: 20 }}>
          {form.full_name} will receive a welcome email at <strong style={{ color: '#DDE3EE' }}>{form.email}</strong> with instructions to set their password and log in.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{ ...S.btn, width: 'auto', padding: '10px 20px', fontSize: 12 }} onClick={() => { setDone(false); setForm({ full_name: '', email: '', role: 'technician', department: 'floor', team: 'A', language: 'en' }) }}>+ Invite Another</button>
          <a href="/settings/users" style={{ ...S.btn, width: 'auto', padding: '10px 20px', fontSize: 12, background: 'transparent', border: '1px solid rgba(255,255,255,.08)', color: '#7C8BA0', textDecoration: 'none', textAlign: 'center' }}>Back to Staff List</a>
        </div>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <a href="/settings/users" style={{ fontSize: 12, color: '#7C8BA0', textDecoration: 'none', display: 'block', marginBottom: 20 }}>← Staff</a>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4 }}>Invite Staff Member</div>
      <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 20 }}>They'll receive a welcome email with a link to set their password.</div>

      {error && <div style={S.error}>{error}</div>}

      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Account Details</div>
          <label style={S.label}>Full Name</label>
          <input style={S.input} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Carlos Martinez" autoFocus />
          <label style={S.label}>Work Email</label>
          <input style={S.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="carlos@yourshop.com" />

          <label style={S.label}>Role</label>
          <select style={{ ...S.input, appearance: 'none', cursor: 'pointer' }} value={form.role} onChange={e => setRole(e.target.value)}>
            <optgroup label="Shop Floor">
              <option value="technician">Mechanic / Technician</option>
              <option value="maintenance_technician">Maintenance Technician</option>
              <option value="maintenance_manager">Floor Supervisor / Maintenance Manager</option>
            </optgroup>
            <optgroup label="Office">
              <option value="service_writer">Service Writer</option>
              <option value="accountant">Accounting</option>
              <option value="office_admin">Office Admin</option>
              <option value="shop_manager">Shop Manager</option>
              <option value="gm">General Manager</option>
            </optgroup>
            <optgroup label="Other Departments">
              <option value="parts_manager">Parts Department</option>
              <option value="fleet_manager">Fleet Manager</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="driver">Driver</option>
            </optgroup>
          </select>

          {/* Department indicator */}
          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            {[
              { key: 'floor', label: 'Shop Floor', icon: '🔧' },
              { key: 'office', label: 'Office', icon: '🏢' },
              { key: 'parts', label: 'Parts Dept', icon: '📦' },
              { key: 'fleet', label: 'Fleet / Field', icon: '🚛' },
            ].map(d => (
              <div key={d.key} style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: form.department === d.key ? 'rgba(29,111,232,.1)' : '#1C2130',
                color: form.department === d.key ? '#4D9EFF' : '#48536A',
                border: form.department === d.key ? '1px solid rgba(29,111,232,.3)' : '1px solid rgba(255,255,255,.06)',
              }}>
                {d.icon} {d.label}
              </div>
            ))}
          </div>

          {/* Team assignment — only for floor roles */}
          {needsTeam ? (
            <>
              <label style={S.label}>Team Assignment</label>
              <select style={{ ...S.input, appearance: 'none', cursor: 'pointer' }} value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}>
                <option value="A">Team A — Engine & Diagnostics</option>
                <option value="B">Team B — Electrical</option>
                <option value="C">Team C — Body & Chassis</option>
                <option value="D">Team D — Inspection</option>
              </select>
            </>
          ) : (
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 8, fontSize: 11, color: '#48536A', marginBottom: 10 }}>
              {form.department === 'office' ? '🏢 Office staff — no team assignment required' :
               form.department === 'parts' ? '📦 Parts department — independent of floor teams' :
               '🚛 Fleet/field role — no team assignment required'}
            </div>
          )}

          <label style={S.label}>Language</label>
          <select style={{ ...S.input, appearance: 'none', cursor: 'pointer' }} value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
            <option value="en">English 🇺🇸</option>
            <option value="ru">Russian 🇷🇺</option>
            <option value="uz">Uzbek 🇺🇿</option>
            <option value="es">Spanish 🇲🇽</option>
          </select>
        </div>

        <div style={{ background: 'rgba(29,111,232,.06)', border: '1px solid rgba(29,111,232,.15)', borderRadius: 9, padding: '12px 14px', fontSize: 11, color: '#7C8BA0', marginBottom: 12 }}>
          A welcome email will be sent with a login link. They set their own password on first login.
        </div>

        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Sending invite...' : 'Send Invite →'}</button>
      </form>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24, maxWidth: 560, margin: '0 auto' },
  card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
  label: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#48536A', marginBottom: 5, display: 'block' },
  input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const, marginBottom: 10 },
  btn: { width: '100%', padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },
  error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
}
