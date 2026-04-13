'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { ADMIN_ROLES } from '@/lib/roles'
import { DEPARTMENT_PERMISSIONS, type DepartmentPermissions } from '@/lib/permissionDefinitions'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans', sans-serif"
const MONO = "'IBM Plex Mono', monospace"
const BLUE = 'var(--tz-accent)'
const PAGE_BG = 'var(--tz-bg)'
const MANAGER_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'parts_manager', 'maintenance_manager', 'office_admin']

export default function PermissionsPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeDept, setActiveDept] = useState<string>('')
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [loading, setLoading] = useState(true)
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  // Get current user and determine available departments
  useEffect(() => {
    getCurrentUser(supabase).then(userData => {
      if (!userData) { window.location.href = '/login'; return }

      if (!MANAGER_ROLES.includes(userData.role)) {
        window.location.href = '/dashboard'
        return
      }

      setCurrentUser(userData)

      const isAdmin = ADMIN_ROLES.includes(userData.role)
      let firstDept = ''
      if (isAdmin) {
        firstDept = DEPARTMENT_PERMISSIONS[0].department
      } else {
        const managedDept = DEPARTMENT_PERMISSIONS.find(d =>
          d.managerRoles.includes(userData.role)
        )
        firstDept = managedDept?.department ?? DEPARTMENT_PERMISSIONS[0].department
      }
      setActiveDept(firstDept)
      setLoading(false)
    })
  }, [])

  // Load employees when department changes
  useEffect(() => {
    if (!activeDept || !currentUser) return
    setSelectedEmployee(null)
    setPermissions({})
    loadEmployees(activeDept)
  }, [activeDept, currentUser])

  const loadEmployees = async (dept: string) => {
    setLoadingEmployees(true)
    const res = await fetch(`/api/permissions/${currentUser.shop_id}/department/${dept}`)
    const data = await res.json()
    setEmployees(data.employees ?? [])
    setLoadingEmployees(false)
  }

  const selectEmployee = (emp: any) => {
    setSelectedEmployee(emp)
    setSaveStatus('idle')

    const deptDef = DEPARTMENT_PERMISSIONS.find(d => d.department === activeDept)
    if (!deptDef) return

    const permState: Record<string, boolean> = {}
    deptDef.permissions.forEach(p => {
      permState[p.key] = emp.permissions[p.key] !== undefined
        ? emp.permissions[p.key]
        : p.defaultValue
    })
    setPermissions(permState)
  }

  const togglePermission = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }))
    setSaveStatus('idle')
  }

  const savePermissions = async () => {
    if (!selectedEmployee || !currentUser) return
    setSaving(true)
    try {
      const res = await fetch(`/api/permissions/${currentUser.shop_id}/${selectedEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions, department: activeDept }),
      })
      if (res.ok) {
        setSaveStatus('saved')
        setEmployees(prev => prev.map(e =>
          e.id === selectedEmployee.id ? { ...e, permissions } : e
        ))
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    }
    setSaving(false)
  }

  const isAdmin = ADMIN_ROLES.includes(currentUser?.role)
  const visibleDepts = isAdmin
    ? DEPARTMENT_PERMISSIONS
    : DEPARTMENT_PERMISSIONS.filter(d => d.managerRoles.includes(currentUser?.role))

  const activeDeptDef = DEPARTMENT_PERMISSIONS.find(d => d.department === activeDept)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, fontFamily: FONT }}>
        <span style={{ color: 'var(--tz-textSecondary)', fontSize: 14 }}>Loading...</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: FONT, padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--tz-text)' }}>Employee Permissions</div>
        <div style={{ fontSize: 13, color: 'var(--tz-textSecondary)', marginTop: 4 }}>Control what each team member can see and do</div>
      </div>

      {/* Department Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${'var(--tz-border)'}`, marginBottom: 24 }}>
        {visibleDepts.map(dept => (
          <button
            key={dept.department}
            onClick={() => setActiveDept(dept.department)}
            style={{
              padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: activeDept === dept.department ? `2px solid ${BLUE}` : '2px solid transparent',
              color: activeDept === dept.department ? BLUE : 'var(--tz-textSecondary)',
              fontWeight: activeDept === dept.department ? 700 : 500,
              fontSize: 13, cursor: 'pointer', fontFamily: FONT, marginBottom: -2,
            }}
          >
            {dept.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Employee List */}
        <div style={{ width: 256, flexShrink: 0 }}>
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--tz-bgHover)', borderBottom: `1px solid ${'var(--tz-border)'}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tz-textSecondary)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO }}>
                {activeDeptDef?.label} Team
              </span>
            </div>
            {loadingEmployees ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--tz-textSecondary)' }}>Loading...</div>
            ) : employees.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--tz-textSecondary)' }}>
                No employees in this department
              </div>
            ) : (
              <div>
                {employees.map((emp, i) => (
                  <div
                    key={emp.id}
                    onClick={() => selectEmployee(emp)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      background: selectedEmployee?.id === emp.id ? 'rgba(27,110,230,.06)' : 'var(--tz-bgLight)',
                      borderLeft: selectedEmployee?.id === emp.id ? `2px solid ${BLUE}` : '2px solid transparent',
                      borderBottom: i < employees.length - 1 ? `1px solid ${'var(--tz-bgHover)'}` : 'none',
                      transition: 'all .12s',
                    }}
                    onMouseEnter={e => { if (selectedEmployee?.id !== emp.id) (e.currentTarget as HTMLElement).style.background = 'var(--tz-bgHover)' }}
                    onMouseLeave={e => { if (selectedEmployee?.id !== emp.id) (e.currentTarget as HTMLElement).style.background = 'var(--tz-bgLight)' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tz-text)' }}>{emp.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--tz-textSecondary)', marginTop: 2 }}>{emp.role}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Permission Toggles */}
        <div style={{ flex: 1 }}>
          {!selectedEmployee ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 256, border: `2px dashed ${'var(--tz-border)'}`, borderRadius: 12,
            }}>
              <span style={{ color: 'var(--tz-textSecondary)', fontSize: 13 }}>Select an employee to manage their permissions</span>
            </div>
          ) : (
            <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Employee Header */}
              <div style={{
                padding: '16px 24px', background: 'var(--tz-bgHover)', borderBottom: `1px solid ${'var(--tz-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tz-text)' }}>{selectedEmployee.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginTop: 2 }}>{selectedEmployee.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {saveStatus === 'saved' && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>Saved</span>
                  )}
                  {saveStatus === 'error' && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>Save failed</span>
                  )}
                  <button
                    onClick={savePermissions}
                    disabled={saving}
                    style={{
                      padding: '8px 20px', background: BLUE, border: 'none', borderRadius: 8,
                      color: 'var(--tz-bgLight)', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                      fontFamily: FONT, opacity: saving ? 0.5 : 1, transition: 'opacity .12s',
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Permission List */}
              <div>
                {activeDeptDef?.permissions.map((perm, i) => (
                  <div
                    key={perm.key}
                    style={{
                      padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: i < (activeDeptDef.permissions.length - 1) ? `1px solid ${'var(--tz-bgHover)'}` : 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tz-text)' }}>{perm.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--tz-textSecondary)', marginTop: 2 }}>{perm.description}</div>
                    </div>
                    <button
                      onClick={() => togglePermission(perm.key)}
                      style={{
                        position: 'relative', display: 'inline-flex', flexShrink: 0,
                        height: 24, width: 44, cursor: 'pointer',
                        borderRadius: 12, border: 'none', padding: 0,
                        background: permissions[perm.key] ? BLUE : 'var(--tz-border)',
                        transition: 'background .2s',
                      }}
                    >
                      <span style={{
                        display: 'inline-block', height: 20, width: 20,
                        borderRadius: 10, background: 'var(--tz-bgLight)',
                        boxShadow: '0 1px 3px rgba(0,0,0,.15)',
                        transform: permissions[perm.key] ? 'translateX(22px)' : 'translateX(2px)',
                        transition: 'transform .2s',
                        marginTop: 2,
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
