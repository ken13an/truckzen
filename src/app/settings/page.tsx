'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const SECTIONS = [
  { key: 'team', label: 'Team Members', href: '/settings/users' },
  { key: 'tax', label: 'Tax & Location' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'billing', label: 'Billing' },
  { key: 'shop', label: 'Shop Information' },
]

export default function SettingsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [shop, setShop] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editShop, setEditShop] = useState<any>({})
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      if (!['owner', 'gm', 'it_person', 'office_admin'].includes(profile.role)) { window.location.href = '/dashboard'; return }
      setUser(profile)
      const { data } = await supabase.from('shops').select('*').eq('id', profile.shop_id).single()
      if (data) { setShop(data); setEditShop(data) }
    }
    load()
  }, [])

  async function saveShop() {
    setSaving(true)
    await supabase.from('shops').update({ name: editShop.name, dba: editShop.dba, phone: editShop.phone, email: editShop.email, address: editShop.address }).eq('id', shop.id)
    setShop(editShop); setSaving(false); setEditing(false)
  }

  async function saveTax() {
    setSaving(true)
    await supabase.from('shops').update({ state: editShop.state, county: editShop.county, tax_rate: parseFloat(editShop.tax_rate) || 0, tax_labor: editShop.tax_labor || false }).eq('id', shop.id)
    setShop({ ...shop, state: editShop.state, county: editShop.county, tax_rate: editShop.tax_rate, tax_labor: editShop.tax_labor })
    setSaving(false); alert('Tax settings saved')
  }

  const S = {
    page: { background: '#0C0C12', minHeight: '100vh', color: '#EDEDF0', fontFamily: "'Instrument Sans', sans-serif", padding: 24 } as React.CSSProperties,
    card: { background: '#151520', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20, maxWidth: 560, marginBottom: 16 } as React.CSSProperties,
    label: { fontSize: 11, fontWeight: 600, color: '#9D9DA1', textTransform: 'uppercase' as const, letterSpacing: '.04em', display: 'block', marginBottom: 4, marginTop: 10 } as React.CSSProperties,
    input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#EDEDF0', outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const } as React.CSSProperties,
    val: { fontSize: 13, color: '#EDEDF0', padding: '6px 0' } as React.CSSProperties,
    btn: { padding: '8px 18px', background: '#1D6FE8', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
    menuItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer', fontSize: 14, color: '#EDEDF0', fontWeight: 500 } as React.CSSProperties,
  }

  function handleSectionClick(s: typeof SECTIONS[0]) {
    if (s.href) { window.location.href = s.href; return }
    setActiveSection(s.key)
  }

  // Main menu
  if (!activeSection) {
    return (
      <div style={S.page}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Settings</div>
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          {SECTIONS.map(s => (
            <div key={s.key} style={S.menuItem} onClick={() => handleSectionClick(s)}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span>{s.label}</span>
              <span style={{ color: '#9D9DA1' }}>&rarr;</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const backBar = (
    <div onClick={() => setActiveSection(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9D9DA1', cursor: 'pointer', marginBottom: 20 }}>
      <span>&larr;</span> Settings
    </div>
  )

  // Tax & Location
  if (activeSection === 'tax') {
    return (
      <div style={S.page}>
        {backBar}
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Tax & Location</div>
        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={S.label}>State</label><input style={S.input} value={editShop.state || ''} onChange={e => setEditShop({ ...editShop, state: e.target.value })} placeholder="Illinois" /></div>
            <div><label style={S.label}>County / City</label><input style={S.input} value={editShop.county || ''} onChange={e => setEditShop({ ...editShop, county: e.target.value })} placeholder="Cook" /></div>
            <div><label style={S.label}>Tax Rate %</label><input style={S.input} type="number" step="0.01" value={editShop.tax_rate || ''} onChange={e => setEditShop({ ...editShop, tax_rate: e.target.value })} placeholder="10.25" /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#EDEDF0', cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={editShop.tax_labor || false} onChange={e => setEditShop({ ...editShop, tax_labor: e.target.checked })} style={{ width: 16, height: 16 }} />
            Tax labor (default: off)
          </label>
          <button style={S.btn} onClick={saveTax} disabled={saving}>{saving ? 'Saving...' : 'Save Tax Settings'}</button>
        </div>
      </div>
    )
  }

  // Shop Information (read-only by default)
  if (activeSection === 'shop') {
    return (
      <div style={S.page}>
        {backBar}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Shop Information</div>
          {!editing && <button style={S.btn} onClick={() => { setEditShop({ ...shop }); setEditing(true) }}>Edit</button>}
        </div>
        <div style={S.card}>
          {editing ? (
            <>
              <label style={S.label}>Legal Name</label><input style={S.input} value={editShop.name || ''} onChange={e => setEditShop({ ...editShop, name: e.target.value })} />
              <label style={S.label}>DBA / Display Name</label><input style={S.input} value={editShop.dba || ''} onChange={e => setEditShop({ ...editShop, dba: e.target.value })} />
              <label style={S.label}>Phone</label><input style={S.input} value={editShop.phone || ''} onChange={e => setEditShop({ ...editShop, phone: e.target.value })} />
              <label style={S.label}>Email</label><input style={S.input} type="email" value={editShop.email || ''} onChange={e => setEditShop({ ...editShop, email: e.target.value })} />
              <label style={S.label}>Address</label><input style={S.input} value={editShop.address || ''} onChange={e => setEditShop({ ...editShop, address: e.target.value })} />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={S.btn} onClick={saveShop} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button style={{ ...S.btn, background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: '#9D9DA1' }} onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              {[
                { label: 'Legal Name', value: shop.name },
                { label: 'DBA / Display Name', value: shop.dba },
                { label: 'Phone', value: shop.phone },
                { label: 'Email', value: shop.email },
                { label: 'Address', value: shop.address },
              ].map(f => (
                <div key={f.label}><label style={S.label}>{f.label}</label><div style={S.val}>{f.value || '—'}</div></div>
              ))}
            </>
          )}
        </div>
      </div>
    )
  }

  // Integrations
  if (activeSection === 'integrations') {
    return (
      <div style={S.page}>
        {backBar}
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Integrations</div>
        <div style={S.card}>
          {[
            { name: 'Stripe', desc: 'Payment processing' },
            { name: 'QuickBooks Online', desc: 'Accounting sync' },
            { name: 'Twilio', desc: 'SMS notifications' },
            { name: 'Samsara GPS', desc: 'Fleet tracking' },
          ].map(int => (
            <div key={int.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>{int.name}</div><div style={{ fontSize: 11, color: '#9D9DA1' }}>{int.desc}</div></div>
              <button style={{ padding: '5px 14px', borderRadius: 7, background: 'rgba(29,111,232,.1)', border: '1px solid rgba(29,111,232,.25)', color: '#4D9EFF', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Connect</button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Notifications / Billing — coming soon
  return (
    <div style={S.page}>
      {backBar}
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{SECTIONS.find(s => s.key === activeSection)?.label}</div>
      <div style={S.card}>
        <div style={{ color: '#9D9DA1', fontSize: 13, padding: 20, textAlign: 'center' }}>Coming soon</div>
      </div>
    </div>
  )
}
