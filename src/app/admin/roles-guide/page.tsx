'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { MODULES, ALL_ROLES, DEFAULT_ROLE_PERMISSIONS, ROLE_LABEL, ROLE_COLOR, ROLE_REDIRECT, hasAccess } from '@/lib/permissions'

export default function RolesGuidePage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!['owner', 'gm', 'it_person'].includes(p.role)) { window.location.href = '/403'; return }
      setUser(p)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0' }}>Loading...</div>

  const roleGroups = [
    { title: 'Owner / Admin', roles: ['owner', 'gm', 'it_person'], desc: 'Full access to all modules, billing, permissions, integrations.' },
    { title: 'Service Writers (Office)', roles: ['shop_manager', 'service_writer', 'office_admin'], desc: 'Office staff — service orders, customers, invoices. Not assigned to floor teams.' },
    { title: 'Floor Supervisor & Mechanics', roles: ['technician', 'maintenance_technician', 'maintenance_manager'], desc: 'Floor employees — assigned to teams. Supervisors lead one or more teams of mechanics.' },
    { title: 'Parts Department', roles: ['parts_manager'], desc: 'Own group — inventory, POs, vendor management. Not in floor teams.' },
    { title: 'Fleet & Compliance', roles: ['fleet_manager'], desc: 'Assets, drivers, compliance, tire health, PM schedules, DVIRs.' },
    { title: 'Accounting (Office)', roles: ['accountant'], desc: 'Office staff — invoices, payments, reports. Not assigned to floor teams.' },
    { title: 'Field', roles: ['dispatcher', 'driver'], desc: 'Fleet dispatch, driver assignments, DVIRs.' },
  ]

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={S.title}>Role & Permissions Guide</div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>Complete reference for all {ALL_ROLES.length} roles and {MODULES.length} modules</div>
        </div>
        <button onClick={() => window.print()} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: '#fff' }}>
          Print / Save PDF
        </button>
      </div>

      {/* Role cards by group */}
      {roleGroups.map(group => (
        <div key={group.title} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>{group.title}</div>
          <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 16 }}>{group.desc}</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
            {group.roles.map(role => {
              const perms = DEFAULT_ROLE_PERMISSIONS[role] || {}
              const allowed = MODULES.filter(m => perms[m.key])
              const denied = MODULES.filter(m => !perms[m.key])

              return (
                <div key={role} style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${ROLE_COLOR[role]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: ROLE_COLOR[role] }}>
                      {ROLE_LABEL[role]?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF' }}>{ROLE_LABEL[role]}</div>
                      <div style={{ fontSize: 10, color: '#48536A', fontFamily: 'monospace' }}>{role} · Landing: {ROLE_REDIRECT[role]}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, color: '#22C55E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Has Access ({allowed.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {allowed.map(m => (
                      <span key={m.key} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(34,197,94,.08)', color: '#22C55E', fontWeight: 500 }}>
                        {m.icon} {m.label}
                      </span>
                    ))}
                  </div>

                  {denied.length > 0 && denied.length < MODULES.length && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#48536A', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        No Access ({denied.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {denied.map(m => (
                          <span key={m.key} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,.03)', color: '#48536A' }}>
                            {m.label}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Full matrix */}
      <div style={{ marginTop: 40, pageBreakBefore: 'always' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', marginBottom: 16 }}>Complete Permission Matrix</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ ...S.table, fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, minWidth: 130 }}>Module</th>
                {ALL_ROLES.map(r => <th key={r} style={{ ...S.th, textAlign: 'center', writingMode: 'vertical-rl', minWidth: 30, padding: '8px 2px', height: 80 }}><span style={{ color: ROLE_COLOR[r] }}>{ROLE_LABEL[r]}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {MODULES.map(m => (
                <tr key={m.key}>
                  <td style={{ ...S.td, fontWeight: 600, whiteSpace: 'nowrap' }}>{m.icon} {m.label}</td>
                  {ALL_ROLES.map(r => {
                    const on = DEFAULT_ROLE_PERMISSIONS[r]?.[m.key]
                    return <td key={r} style={{ ...S.td, textAlign: 'center', fontSize: 14 }}>{on ? '✓' : '—'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { color: #000 !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', letterSpacing: '.03em' },
  card: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 20 },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#48536A', textTransform: 'uppercase' as const, letterSpacing: '.06em', padding: '8px 6px', textAlign: 'left' as const, background: '#0B0D11' },
  td: { padding: '6px 6px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 11 },
}
