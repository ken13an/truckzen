'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'gm', label: 'Admin' },
  { value: 'service_writer', label: 'Service Writer' },
  { value: 'shop_manager', label: 'Floor Supervisor' },
  { value: 'technician', label: 'Mechanic / Technician' },
  { value: 'parts_manager', label: 'Parts Department' },
  { value: 'accountant', label: 'Accounting' },
  { value: 'office_admin', label: 'View Only' },
  { value: 'it_person', label: 'IT Admin' },
  { value: 'fleet_manager', label: 'Fleet Manager' },
  { value: 'maintenance_technician', label: 'Maintenance Tech' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'driver', label: 'Driver' },
]

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]))

const font = "'Instrument Sans', sans-serif"

export default function UsersPage() {
  const supabase = createClient()
  const [me, setMe] = useState<UserProfile | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'technician', team: '' })
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  async function load() {
    const profile = await getCurrentUser(supabase)
    if (!profile) { window.location.href = '/login'; return }
    if (!['owner', 'gm', 'it_person'].includes(profile.role)) { window.location.href = '/dashboard'; return }
    setMe(profile)
    const res = await fetch(`/api/users?shop_id=${profile.shop_id}`)
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveUser() {
    if (!editing) return
    setSaving(true)
    await fetch(`/api/users/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editing.role, team: editing.team, full_name: editing.full_name, telegram_id: editing.telegram_id, active: editing.active }),
    })
    setEditing(null)
    setSaving(false)
    load()
  }

  async function toggleActive(u: any) {
    const action = u.active ? 'Deactivate' : 'Reactivate'
    if (!confirm(`${action} ${u.full_name}?`)) return
    if (u.active) {
      await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) })
    }
    load()
  }

  async function sendInvite() {
    if (!inviteForm.email || !inviteForm.full_name) { setInviteError('Name and email required'); return }
    setInviteError('')
    setInviteSuccess('')
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: me?.shop_id, user_id: me?.id, full_name: inviteForm.full_name, email: inviteForm.email, role: inviteForm.role, team: inviteForm.team || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setInviteError(data.error || 'Failed to invite'); return }
    setInviteSuccess(`Invite sent to ${inviteForm.email}`)
    setInviteForm({ email: '', full_name: '', role: 'technician', team: '' })
    load()
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
  })

  const getStatus = (u: any) => {
    if (!u.active) return { label: 'Disabled', bg: '#FEF2F2', color: '#DC2626' }
    if (!u.last_sign_in_at) return { label: 'Invited', bg: '#FFFBEB', color: '#D97706' }
    return { label: 'Active', bg: '#F0FDF4', color: '#16A34A' }
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: font, padding: 24 }}>
      <a href="/settings" style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none', display: 'block', marginBottom: 20 }}>{'<-'} Settings</a>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A' }}>Team Members</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{users.filter(u => u.active).length} active, {users.filter(u => !u.active).length} disabled</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, role..."
            style={{ padding: '8px 14px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', width: 220, fontFamily: font, background: '#fff' }} />
          <button onClick={() => setInviting(true)}
            style={{ padding: '8px 18px', background: '#1D6FE8', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
            + Invite Team Member
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Name', 'Email', 'Role', 'Team', 'Status', 'Last Login', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const st = getStatus(u)
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6', opacity: u.active ? 1 : 0.6 }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{u.full_name}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>{u.email}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{ROLE_LABEL[u.role] || u.role?.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#6B7280' }}>{u.team ? `Team ${u.team}` : '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditing({ ...u })} style={{ padding: '4px 10px', background: '#EFF6FF', color: '#1D6FE8', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Edit</button>
                      {u.id !== me?.id && (
                        <button onClick={() => toggleActive(u)} style={{ padding: '4px 10px', background: u.active ? '#FEF2F2' : '#F0FDF4', color: u.active ? '#DC2626' : '#16A34A', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
                          {u.active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>Edit User</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Name</label>
              <input value={editing.full_name || ''} onChange={e => setEditing({ ...editing, full_name: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: font, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Email (read-only)</label>
              <input value={editing.email || ''} readOnly style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: font, background: '#F9FAFB', color: '#9CA3AF', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Role</label>
              <select value={editing.role || ''} onChange={e => setEditing({ ...editing, role: e.target.value })}
                disabled={editing.role === 'owner' && me?.role !== 'owner'}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: font, outline: 'none', boxSizing: 'border-box' }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Team</label>
              <select value={editing.team || ''} onChange={e => setEditing({ ...editing, team: e.target.value || null })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: font, outline: 'none', boxSizing: 'border-box' }}>
                <option value="">No team</option>
                {['A', 'B', 'C', 'D'].map(t => <option key={t} value={t}>Team {t}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setEditing(null)} style={{ padding: '8px 18px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Cancel</button>
              <button onClick={saveUser} disabled={saving} style={{ padding: '8px 18px', background: '#1D6FE8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* INVITE MODAL */}
      {inviting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setInviting(false); setInviteError(''); setInviteSuccess('') } }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>Invite Team Member</div>

            {inviteError && <div style={{ padding: '8px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{inviteError}</div>}
            {inviteSuccess && <div style={{ padding: '8px 12px', background: '#F0FDF4', color: '#16A34A', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{inviteSuccess}</div>}

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Full Name *</label>
              <input value={inviteForm.full_name} onChange={e => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: font, outline: 'none', boxSizing: 'border-box' }} placeholder="John Smith" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Email *</label>
              <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: font, outline: 'none', boxSizing: 'border-box' }} placeholder="john@company.com" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Role</label>
              <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: font, outline: 'none', boxSizing: 'border-box' }}>
                {ROLES.filter(r => r.value !== 'owner').map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Team</label>
              <select value={inviteForm.team} onChange={e => setInviteForm({ ...inviteForm, team: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: font, outline: 'none', boxSizing: 'border-box' }}>
                <option value="">No team</option>
                {['A', 'B', 'C', 'D'].map(t => <option key={t} value={t}>Team {t}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setInviting(false); setInviteError(''); setInviteSuccess('') }} style={{ padding: '8px 18px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Cancel</button>
              <button onClick={sendInvite} disabled={saving} style={{ padding: '8px 18px', background: '#1D6FE8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>{saving ? 'Sending...' : 'Send Invite'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
