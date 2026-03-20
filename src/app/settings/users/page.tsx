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
  const [toast, setToast] = useState('')
  const [removing, setRemoving] = useState<any>(null)
  const [confirmText, setConfirmText] = useState('')

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

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function saveUser() {
    if (!editing) return
    setSaving(true)
    await fetch(`/api/users/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editing.role, team: editing.team, full_name: editing.full_name }),
    })
    setEditing(null); setSaving(false); showToast('User updated'); load()
  }

  async function disableUser(u: any) {
    if (confirmText !== 'CONFIRM') return
    await fetch(`/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) })
    setRemoving(null); setConfirmText(''); showToast(`${u.full_name} disabled`); load()
  }

  async function deleteUser(u: any) {
    if (confirmText !== 'CONFIRM') return
    await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    setRemoving(null); setConfirmText(''); showToast(`${u.full_name} removed`); load()
  }

  async function enableUser(u: any) {
    await fetch(`/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) })
    showToast(`${u.full_name} enabled`); load()
  }

  async function resendInvite(u: any) {
    setSaving(true)
    const res = await fetch('/api/users/resend-invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, full_name: u.full_name, shop_id: me?.shop_id }),
    })
    setSaving(false)
    if (res.ok) showToast(`Invite resent to ${u.email}`)
    else showToast('Failed to resend invite')
  }

  async function sendInvite() {
    if (!inviteForm.email || !inviteForm.full_name) { setInviteError('Name and email required'); return }
    setInviteError(''); setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: me?.shop_id, user_id: me?.id, full_name: inviteForm.full_name, email: inviteForm.email, role: inviteForm.role, team: inviteForm.team || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setInviteError(data.error || 'Failed to invite'); return }
    setInviting(false); setInviteForm({ email: '', full_name: '', role: 'technician', team: '' })
    showToast(`Invite sent to ${inviteForm.email}`); load()
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || (ROLE_LABEL[u.role] || u.role)?.toLowerCase().includes(q)
  })

  const getStatus = (u: any) => {
    if (!u.active) return { label: 'Disabled', bg: 'rgba(220,38,38,.12)', color: '#FF453A' }
    if (!u.last_sign_in_at) return { label: 'Invited', bg: 'rgba(217,119,6,.12)', color: '#FFD60A' }
    return { label: 'Active', bg: 'rgba(29,184,112,.12)', color: '#1DB870' }
  }

  const S = {
    input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#EDEDF0', outline: 'none', fontFamily: font, boxSizing: 'border-box' as const },
    label: { fontSize: 11, fontWeight: 600, color: '#9D9DA1', textTransform: 'uppercase' as const, display: 'block', marginBottom: 4, letterSpacing: '.04em' } as React.CSSProperties,
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0C0C12', fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9D9DA1' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#0C0C12', fontFamily: font, padding: 24, color: '#EDEDF0' }}>
      {/* Toast */}
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: '#1D6FE8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>{toast}</div>}

      {/* Back */}
      <div onClick={() => window.location.href = '/settings'} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9D9DA1', cursor: 'pointer', marginBottom: 20 }}>
        <span>&larr;</span> Settings
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>Team Members</div>
          <div style={{ fontSize: 13, color: '#9D9DA1' }}>{users.filter(u => u.active).length} active, {users.filter(u => !u.active).length} disabled</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, role..."
            style={{ padding: '8px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, outline: 'none', width: 220, fontFamily: font, color: '#EDEDF0' }} />
          <button onClick={() => setInviting(true)}
            style={{ padding: '8px 18px', background: '#1D6FE8', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
            + Invite Team Member
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#151520', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                {['Name', 'Email', 'Role', 'Team', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9D9DA1', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'IBM Plex Mono', monospace" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9D9DA1' }}>No users found</td></tr>}
              {filtered.map(u => {
                const st = getStatus(u)
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', opacity: u.active ? 1 : 0.5 }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700 }}>{u.full_name}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#9D9DA1', fontFamily: 'monospace' }}>{u.email}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12 }}>{ROLE_LABEL[u.role] || u.role?.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#9D9DA1' }}>{u.team ? `Team ${u.team}` : '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 10, color: '#9D9DA1', fontFamily: 'monospace' }}>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditing({ ...u })} style={{ padding: '4px 10px', background: 'none', color: '#4D9EFF', border: '1px solid rgba(29,111,232,.3)', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: font, height: 26 }}>Edit</button>
                        {!u.last_sign_in_at && u.active && (
                          <button onClick={() => resendInvite(u)} disabled={saving} style={{ padding: '4px 10px', background: 'none', color: '#FFD60A', border: '1px solid rgba(217,119,6,.3)', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: font, height: 26 }}>Resend</button>
                        )}
                        {u.id !== me?.id && (
                          u.active ? (
                            <button onClick={() => { setRemoving(u); setConfirmText('') }} style={{ padding: '4px 10px', background: 'none', color: '#FF453A', border: '1px solid rgba(220,38,38,.3)', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: font, height: 26 }}>Remove</button>
                          ) : (
                            <button onClick={() => enableUser(u)} style={{ padding: '4px 10px', background: 'none', color: '#1DB870', border: '1px solid rgba(29,184,112,.3)', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: font, height: 26 }}>Enable</button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div style={{ background: '#1A1A26', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Edit User</div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Name</label>
              <input value={editing.full_name || ''} onChange={e => setEditing({ ...editing, full_name: e.target.value })} style={S.input} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Email (read-only)</label>
              <input value={editing.email || ''} readOnly style={{ ...S.input, opacity: 0.5 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Role</label>
              <select value={editing.role || ''} onChange={e => setEditing({ ...editing, role: e.target.value })}
                disabled={editing.role === 'owner' && me?.role !== 'owner'}
                style={{ ...S.input, appearance: 'auto' as any }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Team</label>
              <select value={editing.team || ''} onChange={e => setEditing({ ...editing, team: e.target.value || null })} style={{ ...S.input, appearance: 'auto' as any }}>
                <option value="">No team</option>
                {['A', 'B', 'C', 'D'].map(t => <option key={t} value={t}>Team {t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setEditing(null)} style={{ padding: '8px 18px', background: 'transparent', color: '#9D9DA1', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Cancel</button>
              <button onClick={saveUser} disabled={saving} style={{ padding: '8px 18px', background: '#1D6FE8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setInviting(false); setInviteError('') } }}>
          <div style={{ background: '#1A1A26', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Invite Team Member</div>
            {inviteError && <div style={{ padding: '8px 12px', background: 'rgba(220,38,38,.1)', color: '#FF453A', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{inviteError}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Full Name *</label>
              <input value={inviteForm.full_name} onChange={e => setInviteForm({ ...inviteForm, full_name: e.target.value })} style={S.input} placeholder="John Smith" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Email *</label>
              <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} style={S.input} placeholder="john@company.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Role</label>
              <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })} style={{ ...S.input, appearance: 'auto' as any }}>
                {ROLES.filter(r => r.value !== 'owner').map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Team</label>
              <select value={inviteForm.team} onChange={e => setInviteForm({ ...inviteForm, team: e.target.value })} style={{ ...S.input, appearance: 'auto' as any }}>
                <option value="">No team</option>
                {['A', 'B', 'C', 'D'].map(t => <option key={t} value={t}>Team {t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setInviting(false); setInviteError('') }} style={{ padding: '8px 18px', background: 'transparent', color: '#9D9DA1', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Cancel</button>
              <button onClick={sendInvite} disabled={saving} style={{ padding: '8px 18px', background: '#1D6FE8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>{saving ? 'Sending...' : 'Send Invite'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Modal */}
      {removing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setRemoving(null); setConfirmText('') } }}>
          <div style={{ background: '#1A1A26', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Remove {removing.full_name}</div>
            <div style={{ fontSize: 12, color: '#9D9DA1', marginBottom: 16 }}>Choose how to handle this user:</div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Type CONFIRM to proceed</label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value.toUpperCase())} placeholder="CONFIRM" style={S.input} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => { setRemoving(null); setConfirmText('') }} style={{ padding: '8px 16px', background: 'transparent', color: '#9D9DA1', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Cancel</button>
              <button onClick={() => disableUser(removing)} disabled={confirmText !== 'CONFIRM'}
                style={{ padding: '8px 16px', background: 'rgba(217,119,6,.15)', color: '#FFD60A', border: '1px solid rgba(217,119,6,.3)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: confirmText === 'CONFIRM' ? 'pointer' : 'not-allowed', fontFamily: font, opacity: confirmText === 'CONFIRM' ? 1 : 0.4 }}>
                Disable Account
              </button>
              <button onClick={() => deleteUser(removing)} disabled={confirmText !== 'CONFIRM'}
                style={{ padding: '8px 16px', background: 'rgba(220,38,38,.15)', color: '#FF453A', border: '1px solid rgba(220,38,38,.3)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: confirmText === 'CONFIRM' ? 'pointer' : 'not-allowed', fontFamily: font, opacity: confirmText === 'CONFIRM' ? 1 : 0.4 }}>
                Delete Permanently
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#9D9DA1', marginTop: 12 }}>
              Disable: blocks login, keeps name in historical records. Delete: removes from system, name stays in WO history.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
