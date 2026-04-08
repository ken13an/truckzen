'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { ADMIN_ROLES } from '@/lib/roles'
import Pagination from '@/components/Pagination'
import { Search, X, UserPlus, ChevronLeft } from 'lucide-react'

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'gm', label: 'General Manager' },
  { value: 'shop_manager', label: 'Shop Manager' },
  { value: 'service_writer', label: 'Service Writer' },
  { value: 'service_manager', label: 'Service Manager' },
  { value: 'technician', label: 'Mechanic / Technician' },
  { value: 'floor_manager', label: 'Floor Manager' },
  { value: 'parts_manager', label: 'Parts Department' },
  { value: 'accountant', label: 'Accounting' },
  { value: 'accounting_manager', label: 'Accounting Manager' },
  { value: 'office_admin', label: 'Office Admin' },
  { value: 'it_person', label: 'IT Admin' },
  { value: 'fleet_manager', label: 'Fleet Manager' },
  { value: 'maintenance_technician', label: 'Maintenance Tech' },
  { value: 'maintenance_manager', label: 'Maintenance Manager' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'driver', label: 'Driver' },
]
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]))

const DEPARTMENTS = [
  { key: '', label: 'All' },
  { key: 'service', label: 'Service' },
  { key: 'parts', label: 'Parts' },
  { key: 'floor', label: 'Floor' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'fleet', label: 'Fleet' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'management', label: 'Management' },
]

const STATUSES = [
  { key: '', label: 'All Status' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'inactive', label: 'Inactive' },
]

const font = "'Instrument Sans', sans-serif"
const mono = "'IBM Plex Mono', monospace"

export default function UsersPage() {
  const supabase = createClient()
  const [me, setMe] = useState<UserProfile | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [deptCounts, setDeptCounts] = useState<Record<string, number>>({})

  // Filters
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  // Modals
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'technician', team: '' })
  const [inviteError, setInviteError] = useState('')
  const [toast, setToast] = useState('')
  const [removing, setRemoving] = useState<any>(null)
  const [confirmText, setConfirmText] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchMembers = useCallback(async (profile: UserProfile) => {
    const params = new URLSearchParams({ shop_id: profile.shop_id, page: String(page), limit: '25' })
    if (search) params.set('search', search)
    if (department) params.set('department', department)
    if (role) params.set('role', role)
    if (status) params.set('status', status)

    const res = await fetch(`/api/team?${params}`)
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members)
      setTotal(data.total)
      setPages(data.pages)
      setDeptCounts(data.department_counts)
    }
    setLoading(false)
  }, [page, search, department, role, status])

  useEffect(() => {
    getCurrentUser(supabase).then(p => {
      if (!p) { window.location.href = '/login'; return }
      if (!ADMIN_ROLES.includes(p.role)) { window.location.href = '/dashboard'; return }
      setMe(p)
    })
  }, [])

  useEffect(() => {
    if (me) fetchMembers(me)
  }, [me, fetchMembers])

  // Debounce search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const hasFilters = search || department || role || status
  const clearFilters = () => { setSearchInput(''); setSearch(''); setDepartment(''); setRole(''); setStatus(''); setPage(1) }

  async function saveUser() {
    if (!editing) return
    setSaving(true)
    await fetch(`/api/users/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editing.role, team: editing.team, full_name: editing.full_name }),
    })
    setEditing(null); setSaving(false); showToast('User updated'); if (me) fetchMembers(me)
  }

  async function disableUser(u: any) {
    if (confirmText !== 'CONFIRM') return
    await fetch(`/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) })
    setRemoving(null); setConfirmText(''); showToast(`${u.full_name} deactivated`); if (me) fetchMembers(me)
  }

  async function deleteUser(u: any) {
    if (confirmText !== 'CONFIRM') return
    await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    setRemoving(null); setConfirmText(''); showToast(`${u.full_name} removed`); if (me) fetchMembers(me)
  }

  async function enableUser(u: any) {
    await fetch(`/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) })
    showToast(`${u.full_name} enabled`); if (me) fetchMembers(me)
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
    showToast(`Invite sent to ${inviteForm.email}`); if (me) fetchMembers(me)
  }

  const getStatus = (u: any) => {
    if (!u.active) return { label: 'Inactive', bg: 'rgba(150,150,150,.12)', color: '#9CA3AF' }
    if (!u.last_sign_in_at) return { label: 'Pending', bg: 'rgba(217,119,6,.12)', color: '#F59E0B' }
    return { label: 'Active', bg: 'rgba(29,184,112,.12)', color: '#1DB870' }
  }

  const getInitials = (name: string) => {
    const parts = (name || '').split(' ').filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return (name || '?')[0].toUpperCase()
  }

  const S = {
    input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#EDEDF0', outline: 'none', fontFamily: font, boxSizing: 'border-box' as const },
    label: { fontSize: 11, fontWeight: 600, color: '#9D9DA1', textTransform: 'uppercase' as const, display: 'block', marginBottom: 4, letterSpacing: '.04em' } as React.CSSProperties,
    select: { padding: '8px 12px', background: '#151520', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#EDEDF0', outline: 'none', fontFamily: font, appearance: 'auto' as const, cursor: 'pointer', minWidth: 120 },
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0C0C12', fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9D9DA1' }}>Loading...</div>

  const allCount = Object.values(deptCounts).reduce((a, b) => a + b, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#0C0C12', fontFamily: font, padding: 24, color: '#EDEDF0' }}>
      {/* Toast */}
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: '#1D6FE8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>{toast}</div>}

      {/* Back */}
      <a href="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#9D9DA1', textDecoration: 'none', marginBottom: 20 }}>
        <ChevronLeft size={14} strokeWidth={2} /> Settings
      </a>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>Team Members</div>
          <span style={{ padding: '4px 12px', background: 'rgba(29,111,232,.1)', color: '#4D9EFF', borderRadius: 100, fontSize: 12, fontWeight: 700, fontFamily: mono }}>{total} members</span>
        </div>
        <button onClick={() => setInviting(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#1D6FE8', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
          <UserPlus size={14} strokeWidth={2.5} /> Invite Member
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#48536A' }} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name, email, role..."
            style={{ ...S.input, paddingLeft: 32, width: '100%' }}
          />
        </div>
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1) }} style={S.select}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={S.select}>
          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 8, color: '#FF453A', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Department tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {DEPARTMENTS.map(d => {
          const count = d.key === '' ? allCount : (deptCounts[d.key] || 0)
          const active = department === d.key
          return (
            <button key={d.key} onClick={() => { setDepartment(d.key); setPage(1) }}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 700 : 500,
                background: active ? 'rgba(29,111,232,.12)' : 'transparent',
                border: active ? '1px solid rgba(29,111,232,.3)' : '1px solid rgba(255,255,255,.06)',
                color: active ? '#4D9EFF' : '#7C8BA0',
                cursor: 'pointer', fontFamily: font, whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {d.label}
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: mono, opacity: 0.7 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Staff table */}
      <div style={{ background: '#151520', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                {['Name', 'Role', 'Department', 'Status', 'Last Active', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9D9DA1', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: mono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9D9DA1', fontSize: 13 }}>
                  {hasFilters ? 'No members match your filters' : 'No team members yet'}
                </td></tr>
              )}
              {members.map(u => {
                const st = getStatus(u)
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', opacity: u.active ? 1 : 0.5 }}>
                    {/* Avatar + Name */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: u.active ? 'rgba(29,111,232,.12)' : 'rgba(255,255,255,.06)',
                          color: u.active ? '#4D9EFF' : '#9D9DA1', fontSize: 11, fontWeight: 700, fontFamily: mono, flexShrink: 0,
                        }}>
                          {getInitials(u.full_name)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{u.full_name}</div>
                          <div style={{ fontSize: 10, color: '#7C8BA0', fontFamily: mono }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{ROLE_LABEL[u.role] || u.role?.replace(/_/g, ' ')}</td>
                    {/* Department */}
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'capitalize', color: '#7C8BA0', padding: '3px 8px', background: 'rgba(255,255,255,.04)', borderRadius: 4 }}>
                        {u.department || '—'}
                      </span>
                    </td>
                    {/* Status */}
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    {/* Last Active */}
                    <td style={{ padding: '10px 14px', fontSize: 10, color: '#7C8BA0', fontFamily: mono }}>
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditing({ ...u })} style={btnStyle('#4D9EFF', 'rgba(29,111,232,.3)')}>Edit</button>
                        {!u.last_sign_in_at && u.active && (
                          <button onClick={() => resendInvite(u)} disabled={saving} style={btnStyle('#F59E0B', 'rgba(217,119,6,.3)')}>Resend</button>
                        )}
                        {u.id !== me?.id && (
                          u.active ? (
                            <button onClick={() => { setRemoving(u); setConfirmText('') }} style={btnStyle('#FF453A', 'rgba(220,38,38,.3)')}>Deactivate</button>
                          ) : (
                            <button onClick={() => enableUser(u)} style={btnStyle('#1DB870', 'rgba(29,184,112,.3)')}>Enable</button>
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

      <Pagination page={page} totalPages={pages} total={total} label="team members" onPageChange={setPage} />

      {/* Edit Modal */}
      {editing && (
        <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div style={modalBox}>
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
        <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) { setInviting(false); setInviteError('') } }}>
          <div style={modalBox}>
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

      {/* Remove/Deactivate Modal */}
      {removing && (
        <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) { setRemoving(null); setConfirmText('') } }}>
          <div style={modalBox}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Remove {removing.full_name}</div>
            <div style={{ fontSize: 12, color: '#9D9DA1', marginBottom: 16 }}>Choose how to handle this user:</div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Type CONFIRM to proceed</label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value.toUpperCase())} placeholder="CONFIRM" style={S.input} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => { setRemoving(null); setConfirmText('') }} style={{ padding: '8px 16px', background: 'transparent', color: '#9D9DA1', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Cancel</button>
              <button onClick={() => disableUser(removing)} disabled={confirmText !== 'CONFIRM'}
                style={{ padding: '8px 16px', background: 'rgba(217,119,6,.15)', color: '#F59E0B', border: '1px solid rgba(217,119,6,.3)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: confirmText === 'CONFIRM' ? 'pointer' : 'not-allowed', fontFamily: font, opacity: confirmText === 'CONFIRM' ? 1 : 0.4 }}>
                Deactivate
              </button>
              <button onClick={() => deleteUser(removing)} disabled={confirmText !== 'CONFIRM'}
                style={{ padding: '8px 16px', background: 'rgba(220,38,38,.15)', color: '#FF453A', border: '1px solid rgba(220,38,38,.3)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: confirmText === 'CONFIRM' ? 'pointer' : 'not-allowed', fontFamily: font, opacity: confirmText === 'CONFIRM' ? 1 : 0.4 }}>
                Delete Permanently
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#9D9DA1', marginTop: 12 }}>
              Deactivate: blocks login, keeps name in historical records. Delete: removes from system, name stays in WO history.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(color: string, border: string): React.CSSProperties {
  return { padding: '4px 10px', background: 'none', color, border: `1px solid ${border}`, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif", height: 26 }
}

const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
const modalBox: React.CSSProperties = { background: '#1A1A26', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }
