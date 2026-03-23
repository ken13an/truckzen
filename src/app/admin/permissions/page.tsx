'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { MODULES, ALL_ROLES, DEFAULT_ROLE_PERMISSIONS, ROLE_LABEL, ROLE_COLOR, hasAccess } from '@/lib/permissions'

type View = 'roles' | 'users' | 'audit'

export default function PermissionsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [view, setView] = useState<View>('roles')
  const [rolePerms, setRolePerms] = useState<Record<string, Record<string, boolean>>>({})
  const [userOverrides, setUserOverrides] = useState<Record<string, Record<string, boolean>>>({})
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  const loadPerms = useCallback(async (shopId: string) => {
    const { data: rp } = await supabase.from('role_permissions').select('role, module, allowed').eq('shop_id', shopId)
    const map: Record<string, Record<string, boolean>> = {}
    for (const r of rp || []) {
      if (!map[r.role]) map[r.role] = {}
      map[r.role][r.module] = r.allowed
    }
    setRolePerms(map)

    const { data: uo } = await supabase.from('user_permission_overrides').select('user_id, module, allowed').eq('shop_id', shopId)
    const umap: Record<string, Record<string, boolean>> = {}
    for (const r of uo || []) {
      if (!umap[r.user_id]) umap[r.user_id] = {}
      umap[r.user_id][r.module] = r.allowed
    }
    setUserOverrides(umap)

    const { data: u } = await supabase.from('users').select('id, full_name, email, role, team, active').eq('shop_id', shopId).eq('active', true).is('deleted_at', null).order('full_name')
    setUsers(u || [])
  }, [supabase])

  const loadAudit = useCallback(async (shopId: string) => {
    const { data } = await supabase.from('permission_audit_log')
      .select('*, users!changed_by(full_name), target_user_profile:users!target_user(full_name)')
      .eq('shop_id', shopId).order('changed_at', { ascending: false }).limit(100)
    setAuditLog(data || [])
  }, [supabase])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!['owner', 'gm', 'it_person'].includes(p.role)) { window.location.href = '/403'; return }
      setUser(p)
      await loadPerms(p.shop_id)
      setLoading(false)
    })
  }, [])

  async function toggleRolePerm(role: string, module: string) {
    const current = hasAccess(role, module, rolePerms[role])
    const newVal = !current
    setSaving(true)

    await supabase.from('role_permissions').upsert({
      shop_id: user.shop_id, role, module, allowed: newVal, updated_by: user.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id,role,module' })

    await supabase.from('permission_audit_log').insert({
      shop_id: user.shop_id, changed_by: user.id, target_role: role, module, old_value: current, new_value: newVal,
    })

    setRolePerms(prev => ({ ...prev, [role]: { ...prev[role], [module]: newVal } }))
    setSaving(false)
    flash(`${ROLE_LABEL[role]}: ${MODULES.find(m => m.key === module)?.label} → ${newVal ? 'ON' : 'OFF'}`)
  }

  async function toggleUserPerm(userId: string, module: string) {
    const u = users.find(x => x.id === userId)
    if (!u) return
    const roleP = rolePerms[u.role] || {}
    const userO = userOverrides[userId] || {}
    const currentEffective = hasAccess(u.role, module, roleP, userO)
    const hasOverride = module in userO

    setSaving(true)

    if (hasOverride) {
      // Remove override → revert to role default
      await supabase.from('user_permission_overrides').delete().eq('shop_id', user.shop_id).eq('user_id', userId).eq('module', module)
      setUserOverrides(prev => {
        const copy = { ...prev, [userId]: { ...prev[userId] } }
        delete copy[userId][module]
        return copy
      })
      flash('Override removed')
    } else {
      // Add override opposite of current
      const newVal = !currentEffective
      await supabase.from('user_permission_overrides').upsert({
        shop_id: user.shop_id, user_id: userId, module, allowed: newVal, updated_by: user.id,
      }, { onConflict: 'shop_id,user_id,module' })

      await supabase.from('permission_audit_log').insert({
        shop_id: user.shop_id, changed_by: user.id, target_user: userId, module, old_value: currentEffective, new_value: newVal,
      })

      setUserOverrides(prev => ({ ...prev, [userId]: { ...prev[userId], [module]: newVal } }))
      flash(`${u.full_name}: ${MODULES.find(m => m.key === module)?.label} → ${newVal ? 'ON' : 'OFF'}`)
    }

    setSaving(false)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0' }}>Loading...</div>

  return (
    <div style={S.page}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#1D6FE8', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ marginBottom: 20 }}>
        <div style={S.title}>Permissions & Access Control</div>
        <div style={{ fontSize: 12, color: '#7C8BA0' }}>{ALL_ROLES.length} roles · {MODULES.length} modules · {users.length} users</div>
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0D0F12', borderRadius: 10, padding: 4 }}>
        {([['roles', 'Role Permissions'], ['users', 'User Overrides'], ['audit', 'Audit Log']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setView(k); if (k === 'audit') loadAudit(user.shop_id) }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: view === k ? '#1A1D23' : 'transparent', color: view === k ? '#F0F4FF' : '#48536A' }}>{l}</button>
        ))}
      </div>

      {/* ROLE PERMISSIONS GRID */}
      {view === 'roles' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, position: 'sticky', left: 0, zIndex: 2, background: '#0B0D11', minWidth: 140 }}>Module</th>
                {ALL_ROLES.map(r => (
                  <th key={r} style={{ ...S.th, textAlign: 'center', minWidth: 70 }}>
                    <div style={{ color: ROLE_COLOR[r], fontSize: 8 }}>{ROLE_LABEL[r]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map(m => (
                <tr key={m.key}>
                  <td style={{ ...S.td, position: 'sticky', left: 0, background: '#060708', zIndex: 1, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                    {m.icon} {m.label}
                  </td>
                  {ALL_ROLES.map(r => {
                    const allowed = hasAccess(r, m.key, rolePerms[r])
                    const isDefault = !(rolePerms[r] && m.key in rolePerms[r])
                    const isUnlimited = ['owner', 'gm', 'it_person'].includes(r)
                    return (
                      <td key={r} style={{ ...S.td, textAlign: 'center', padding: '4px 2px' }}>
                        <button
                          onClick={() => !isUnlimited && toggleRolePerm(r, m.key)}
                          disabled={isUnlimited || saving}
                          style={{
                            width: 32, height: 22, borderRadius: 11, border: 'none', cursor: isUnlimited ? 'default' : 'pointer',
                            background: allowed ? '#22C55E' : '#1A1D23',
                            opacity: isUnlimited ? 0.4 : isDefault ? 0.7 : 1,
                            transition: 'background .15s',
                            position: 'relative',
                          }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%', background: '#fff',
                            position: 'absolute', top: 4, left: allowed ? 14 : 4, transition: 'left .15s',
                          }} />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: '#48536A', marginTop: 8 }}>
            Owner / GM / IT have full access and cannot be restricted. Dimmed toggles use default permissions — click to customize.
          </div>
        </div>
      )}

      {/* USER OVERRIDES */}
      {view === 'users' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {users.map(u => (
              <button key={u.id} onClick={() => setSelectedUser(u)}
                style={{
                  padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: selectedUser?.id === u.id ? '1px solid #1D6FE8' : '1px solid #1A1D23',
                  background: selectedUser?.id === u.id ? 'rgba(29,111,232,.1)' : '#0D0F12',
                  color: selectedUser?.id === u.id ? '#F0F4FF' : '#7C8BA0',
                }}>
                {u.full_name}
                <span style={{ fontSize: 9, color: ROLE_COLOR[u.role], marginLeft: 6 }}>{ROLE_LABEL[u.role]}</span>
              </button>
            ))}
          </div>

          {selectedUser && (
            <div style={S.card}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>{selectedUser.full_name}</div>
              <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 16 }}>
                Role: <span style={{ color: ROLE_COLOR[selectedUser.role] }}>{ROLE_LABEL[selectedUser.role]}</span> · Overrides shown in blue
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                {MODULES.map(m => {
                  const roleP = rolePerms[selectedUser.role] || {}
                  const userO = userOverrides[selectedUser.id] || {}
                  const effective = hasAccess(selectedUser.role, m.key, roleP, userO)
                  const hasOvr = m.key in userO

                  return (
                    <div key={m.key} onClick={() => toggleUserPerm(selectedUser.id, m.key)}
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: hasOvr ? '1px solid #1D6FE8' : '1px solid #1A1D23',
                        background: hasOvr ? 'rgba(29,111,232,.06)' : '#0D0F12',
                      }}>
                      <span style={{ fontSize: 12, color: effective ? '#F0F4FF' : '#48536A' }}>{m.icon} {m.label}</span>
                      <div style={{
                        width: 28, height: 16, borderRadius: 8, background: effective ? '#22C55E' : '#1A1D23',
                        position: 'relative',
                      }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: effective ? 14 : 4, transition: 'left .15s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 10, color: '#48536A', marginTop: 8 }}>Click to toggle. Blue border = user-specific override. Click an override again to remove it and revert to role default.</div>
            </div>
          )}
        </>
      )}

      {/* AUDIT LOG */}
      {view === 'audit' && (
        <>
          <div style={S.sectionLabel}>Permission Changes</div>
          {auditLog.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#48536A' }}>No permission changes recorded yet</div>}
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>When</th><th style={S.th}>Changed By</th><th style={S.th}>Target</th><th style={S.th}>Module</th><th style={S.th}>Change</th>
            </tr></thead>
            <tbody>
              {auditLog.map((a: any) => (
                <tr key={a.id}>
                  <td style={S.td}>{new Date(a.changed_at).toLocaleString()}</td>
                  <td style={S.td}>{(a.users as any)?.full_name}</td>
                  <td style={S.td}>{a.target_role ? <span style={{ color: ROLE_COLOR[a.target_role] }}>{ROLE_LABEL[a.target_role]}</span> : (a.target_user_profile as any)?.full_name}</td>
                  <td style={S.td}>{MODULES.find(m => m.key === a.module)?.label || a.module}</td>
                  <td style={S.td}>
                    <span style={{ color: a.old_value ? '#22C55E' : '#EF4444' }}>{a.old_value ? 'ON' : 'OFF'}</span>
                    {' → '}
                    <span style={{ color: a.new_value ? '#22C55E' : '#EF4444' }}>{a.new_value ? 'ON' : 'OFF'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', letterSpacing: '.03em' },
  card: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: 600, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#48536A', textTransform: 'uppercase' as const, letterSpacing: '.08em', padding: '8px 6px', textAlign: 'left' as const, background: '#0B0D11', whiteSpace: 'nowrap' as const },
  td: { padding: '6px 6px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 11, color: '#A0AABF' },
}
