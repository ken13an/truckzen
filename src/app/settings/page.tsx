'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const SECTIONS = [
  { key: 'team', label: 'Team Members', href: '/settings/users' },
  { key: 'staff_import', label: 'Staff Bulk Import', href: '/settings/staff-import' },
  { key: 'kiosk', label: 'Kiosk Mode' },
  { key: 'tax', label: 'Tax & Location' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'billing', label: 'Billing' },
  { key: 'labor_rates', label: 'Labor Rates' },
  { key: 'shop', label: 'Shop Information' },
  { key: 'branding', label: 'Shop Branding' },
  { key: 'data_retention', label: 'Data Retention' },
  { key: 'security', label: 'Two-Factor Auth (2FA)' },
  { key: 'export', label: 'Data Export', href: '/settings/export' },
]

export default function SettingsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [shop, setShop] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editShop, setEditShop] = useState<any>({})
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [retentionPolicy, setRetentionPolicy] = useState<{ inactive_customers: string; completed_work_orders: string; closed_invoices: string }>({ inactive_customers: 'never', completed_work_orders: 'never', closed_invoices: 'never' })
  const [retentionSaving, setRetentionSaving] = useState(false)
  const [kioskCode, setKioskCode] = useState('')
  const [kioskEnabled, setKioskEnabled] = useState(true)
  const [kioskSaving, setKioskSaving] = useState(false)
  const [kioskCopied, setKioskCopied] = useState(false)
  const [kioskPin, setKioskPin] = useState('0000')
  const [brandingShop, setBrandingShop] = useState<any>({})
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [laborRates, setLaborRates] = useState<any[]>([])
  const [laborSaving, setLaborSaving] = useState(false)

  // 2FA state
  const [tfaStatus, setTfaStatus] = useState<{ enabled: boolean; verified_at: string | null } | null>(null)
  const [tfaQR, setTfaQR] = useState<string | null>(null)
  const [tfaSecret, setTfaSecret] = useState('')
  const [tfaCode, setTfaCode] = useState('')
  const [tfaMsg, setTfaMsg] = useState('')
  const [tfaLoading, setTfaLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      if (!['owner', 'gm', 'it_person', 'office_admin'].includes(profile.role)) { window.location.href = '/dashboard'; return }
      setUser(profile)
      // Load shop settings (includes all shop fields + retention_policy)
      try {
        const shopRes = await fetch(`/api/settings?shop_id=${profile.shop_id}`)
        if (shopRes.ok) {
          const shopData = await shopRes.json()
          setShop(shopData); setEditShop(shopData); setBrandingShop(shopData)
          if (shopData.kiosk_code) setKioskCode(shopData.kiosk_code)
          if (shopData.kiosk_enabled != null) setKioskEnabled(shopData.kiosk_enabled)
          if (shopData.kiosk_pin) setKioskPin(shopData.kiosk_pin)
          if (shopData.retention_policy) setRetentionPolicy(shopData.retention_policy)
        }
      } catch {}
      // Load labor rates
      try {
        const ratesRes = await fetch(`/api/settings/labor-rates?shop_id=${profile.shop_id}`)
        if (ratesRes.ok) {
          const rates = await ratesRes.json()
          if (Array.isArray(rates)) setLaborRates(rates)
        }
      } catch {}
    }
    load()
  }, [])

  // Load 2FA status when security section is opened
  useEffect(() => {
    if (activeSection === 'security') {
      fetch('/api/auth/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status' }) })
        .then(r => r.json()).then(setTfaStatus).catch(() => {})
    }
  }, [activeSection])

  async function saveShop() {
    setSaving(true)
    await supabase.from('shops').update({ name: editShop.name, dba: editShop.dba, phone: editShop.phone, email: editShop.email, address: editShop.address, maintenance_coordinator_phone: editShop.maintenance_coordinator_phone || null, labor_rate: parseFloat(editShop.labor_rate) || null }).eq('id', shop.id)
    setShop(editShop); setSaving(false); setEditing(false)
  }

  async function saveTax() {
    setSaving(true)
    await supabase.from('shops').update({ state: editShop.state, county: editShop.county, tax_rate: parseFloat(editShop.tax_rate) || 0, tax_labor: editShop.tax_labor || false }).eq('id', shop.id)
    setShop({ ...shop, state: editShop.state, county: editShop.county, tax_rate: editShop.tax_rate, tax_labor: editShop.tax_labor })
    setSaving(false); alert('Tax settings saved')
  }

  async function saveRetentionPolicy() {
    setRetentionSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shop.id, retention_policy: retentionPolicy }),
      })
      alert('Retention policy saved')
    } catch {
      alert('Failed to save retention policy')
    }
    setRetentionSaving(false)
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

  // Labor Rates
  if (activeSection === 'labor_rates') {
    const RATE_LABELS: Record<string, { label: string; color: string }> = {
      fleet_asset: { label: 'Company Truck', color: '#1D6FE8' },
      owner_operator: { label: 'Owner Operator', color: '#D97706' },
      outside_customer: { label: 'Outside Customer', color: '#6B7280' },
    }
    async function saveLaborRates() {
      setLaborSaving(true)
      await fetch('/api/settings/labor-rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates: laborRates.map(r => ({ id: r.id, rate_per_hour: r.rate_per_hour })), user_id: user?.id }),
      })
      setLaborSaving(false)
    }
    return (
      <div style={S.page}>
        {backBar}
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4 }}>Labor Rates</div>
        <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 20 }}>Set hourly labor rates by truck type. These rates auto-fill when building estimates.</div>
        <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20 }}>
          {laborRates.length === 0 ? (
            <div style={{ color: '#48536A', fontSize: 13, textAlign: 'center', padding: 20 }}>No labor rates configured. Check database setup.</div>
          ) : laborRates.map((r: any) => {
            const cfg = RATE_LABELS[r.ownership_type] || { label: r.ownership_type, color: '#7C8BA0' }
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                  {r.updated_at && <div style={{ fontSize: 10, color: '#48536A', marginTop: 2 }}>Last updated: {new Date(r.updated_at).toLocaleDateString()}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, color: '#7C8BA0' }}>$</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={r.rate_per_hour}
                    onChange={e => setLaborRates(prev => prev.map(x => x.id === r.id ? { ...x, rate_per_hour: parseFloat(e.target.value) || 0 } : x))}
                    style={{ width: 100, padding: '8px 10px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 14, color: '#DDE3EE', outline: 'none', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right' as const }}
                  />
                  <span style={{ fontSize: 12, color: '#7C8BA0' }}>/hr</span>
                </div>
              </div>
            )
          })}
          {laborRates.some((r: any) => r.rate_per_hour === 0) && (
            <div style={{ padding: '10px 12px', background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.2)', borderRadius: 8, fontSize: 12, color: '#D97706', marginTop: 12 }}>
              Warning: One or more labor rates are $0 — estimates will show $0 labor charges.
            </div>
          )}
          <button onClick={saveLaborRates} disabled={laborSaving} style={{ marginTop: 16, padding: '10px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {laborSaving ? 'Saving...' : 'Save Rates'}
          </button>
        </div>

        {/* Parts Pricing */}
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4, marginTop: 32 }}>Parts Pricing</div>
        <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 20 }}>Set parts markup by truck type. Applied automatically when adding parts to work orders.</div>
        <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20 }}>
          {laborRates.map((r: any) => {
            const cfg = RATE_LABELS[r.ownership_type] || { label: r.ownership_type, color: '#7C8BA0' }
            const costExample = 10
            const markupSell = costExample * (1 + (r.parts_markup_pct || 0) / 100)
            const marginSell = r.parts_margin_pct > 0 ? costExample / (1 - (r.parts_margin_pct || 0) / 100) : costExample
            return (
              <div key={r.id + '-parts'} style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color, marginBottom: 12 }}>{cfg.label}</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Mode</label>
                    <select value={r.parts_pricing_mode || 'markup'} onChange={e => setLaborRates(prev => prev.map(x => x.id === r.id ? { ...x, parts_pricing_mode: e.target.value } : x))}
                      style={{ padding: '8px 10px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                      <option value="markup">Markup %</option>
                      <option value="margin">Margin %</option>
                    </select>
                  </div>
                  {(r.parts_pricing_mode === 'markup' || !r.parts_pricing_mode) && (
                    <div>
                      <label style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Markup %</label>
                      <input type="number" step="0.1" min="0" value={r.parts_markup_pct ?? 0}
                        onChange={e => setLaborRates(prev => prev.map(x => x.id === r.id ? { ...x, parts_markup_pct: parseFloat(e.target.value) || 0 } : x))}
                        style={{ width: 80, padding: '8px 10px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 14, color: '#DDE3EE', outline: 'none', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right' as const }} />
                    </div>
                  )}
                  {r.parts_pricing_mode === 'margin' && (
                    <div>
                      <label style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Margin %</label>
                      <input type="number" step="0.1" min="0" max="99" value={r.parts_margin_pct ?? 0}
                        onChange={e => setLaborRates(prev => prev.map(x => x.id === r.id ? { ...x, parts_margin_pct: parseFloat(e.target.value) || 0 } : x))}
                        style={{ width: 80, padding: '8px 10px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 14, color: '#DDE3EE', outline: 'none', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right' as const }} />
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#7C8BA0', background: 'rgba(255,255,255,.03)', padding: '8px 12px', borderRadius: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
                    Cost $10.00 → Sell <span style={{ fontWeight: 700, color: '#1DB870' }}>${(r.parts_pricing_mode === 'margin' ? marginSell : markupSell).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )
          })}
          <button onClick={async () => {
            setLaborSaving(true)
            await fetch('/api/settings/labor-rates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rates: laborRates.map(r => ({ id: r.id, parts_margin_pct: r.parts_margin_pct, parts_markup_pct: r.parts_markup_pct, parts_pricing_mode: r.parts_pricing_mode })), user_id: user?.id }) })
            setLaborSaving(false)
          }} disabled={laborSaving} style={{ marginTop: 16, padding: '10px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {laborSaving ? 'Saving...' : 'Save Parts Pricing'}
          </button>
        </div>
      </div>
    )
  }

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
              <label style={S.label}>Maintenance Coordinator Phone</label><input style={S.input} value={editShop.maintenance_coordinator_phone || ''} onChange={e => setEditShop({ ...editShop, maintenance_coordinator_phone: e.target.value })} placeholder="+1 (555) 123-4567" />
              <label style={S.label}>Default Labor Rate ($/hr)</label><input style={S.input} type="number" step="0.01" value={editShop.labor_rate || ''} onChange={e => setEditShop({ ...editShop, labor_rate: e.target.value })} placeholder="125.00" />
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
                { label: 'Maintenance Coordinator Phone', value: shop.maintenance_coordinator_phone },
                { label: 'Default Labor Rate ($/hr)', value: shop.labor_rate ? `$${shop.labor_rate}` : null },
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

  // Kiosk Mode
  if (activeSection === 'kiosk') {
    const kioskUrl = kioskCode ? `truckzen.pro/kiosk/${kioskCode}` : ''
    const saveKiosk = async () => {
      if (!user?.shop_id) return
      setKioskSaving(true)
      await supabase.from('shops').update({ kiosk_code: kioskCode.toLowerCase().trim() || null, kiosk_enabled: kioskEnabled, kiosk_pin: kioskPin || '0000' }).eq('id', user.shop_id)
      setKioskSaving(false)
    }
    return (
      <div style={{ padding: 24, maxWidth: 700, margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif", color: '#EDEDF0' }}>
        <button onClick={() => setActiveSection(null)} style={{ background: 'none', border: 'none', color: '#7C8BA0', fontSize: 13, cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' }}>&larr; Back to Settings</button>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Kiosk Mode</h2>

        <div style={{ background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          {kioskCode && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Kiosk URL</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, padding: '10px 14px', background: '#060708', border: '1px solid #1A1D23', borderRadius: 8, fontSize: 14, color: '#4D9EFF' }}>{kioskUrl}</code>
                <button onClick={() => { navigator.clipboard.writeText(`https://${kioskUrl}`); setKioskCopied(true); setTimeout(() => setKioskCopied(false), 2000) }}
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #1A1D23', background: kioskCopied ? 'rgba(34,197,94,.1)' : '#0D0F12', color: kioskCopied ? '#22C55E' : '#7C8BA0', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {kioskCopied ? 'Copied' : 'Copy'}
                </button>
                <a href={`https://${kioskUrl}`} target="_blank" rel="noopener"
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #1A1D23', background: '#0D0F12', color: '#7C8BA0', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Open</a>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Kiosk Code</label>
            <input value={kioskCode} onChange={e => setKioskCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g. ugl" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #1A1D23', background: '#060708', color: '#EDEDF0', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: '#48536A', marginTop: 4 }}>Lowercase letters, numbers, and dashes only. This becomes your kiosk URL.</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={kioskEnabled} onChange={e => setKioskEnabled(e.target.checked)} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Kiosk Enabled</span>
            </label>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Kiosk PIN</label>
            <input value={kioskPin} onChange={e => setKioskPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="0000" maxLength={6}
              style={{ width: 120, padding: '10px 14px', borderRadius: 8, border: '1px solid #1A1D23', background: '#060708', color: '#EDEDF0', fontSize: 18, fontFamily: 'monospace', outline: 'none', letterSpacing: 4, textAlign: 'center' }} />
            <div style={{ fontSize: 11, color: '#48536A', marginTop: 4 }}>4-6 digits. Staff enters PIN once to activate the kiosk tablet. Customers never see it.</div>
          </div>

          <button onClick={saveKiosk} disabled={kioskSaving || !kioskCode.trim()}
            style={{ padding: '10px 24px', borderRadius: 8, background: '#1D6FE8', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: kioskSaving || !kioskCode.trim() ? 0.5 : 1 }}>
            {kioskSaving ? 'Saving...' : 'Save Kiosk Settings'}
          </button>
        </div>

        <div style={{ background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Tablet Setup Instructions</h3>
          <ol style={{ margin: 0, padding: '0 0 0 20px', fontSize: 13, color: '#9D9DA1', lineHeight: 2 }}>
            <li>Open Safari or Chrome on the tablet</li>
            <li>Go to: <strong style={{ color: '#4D9EFF' }}>{kioskUrl || 'truckzen.pro/kiosk/your-code'}</strong></li>
            <li>Tap Share then "Add to Home Screen"</li>
            <li>Enable Guided Access (iPad: Settings &gt; Accessibility &gt; Guided Access) to lock the tablet to the kiosk</li>
          </ol>
        </div>
      </div>
    )
  }

  // Shop Branding
  if (activeSection === 'branding') {
    const saveBranding = async () => {
      setBrandingSaving(true)
      await supabase.from('shops').update({
        name: brandingShop.name, dba: brandingShop.dba, phone: brandingShop.phone, email: brandingShop.email,
        website: brandingShop.website, address: brandingShop.address, city: brandingShop.city,
        state: brandingShop.state, zip: brandingShop.zip, invoice_footer: brandingShop.invoice_footer,
        email_footer: brandingShop.email_footer,
      }).eq('id', shop.id)
      setShop({ ...shop, ...brandingShop })
      setBrandingSaving(false)
      alert('Branding saved')
    }
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setLogoUploading(true)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('shop_id', shop.id)
      try {
        const res = await fetch('/api/shop/logo', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.logo_url) {
          setBrandingShop({ ...brandingShop, logo_url: data.logo_url })
          setShop({ ...shop, logo_url: data.logo_url })
        } else {
          alert(data.error || 'Upload failed')
        }
      } catch { alert('Upload failed') }
      setLogoUploading(false)
    }
    return (
      <div style={S.page}>
        {backBar}
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Shop Branding</div>
        <div style={S.card}>
          <label style={S.label}>Shop Logo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            {brandingShop.logo_url ? (
              <img src={brandingShop.logo_url} alt="Logo" style={{ maxHeight: 50, maxWidth: 200, borderRadius: 6, background: 'rgba(255,255,255,.06)', padding: 4 }} />
            ) : (
              <div style={{ width: 80, height: 50, background: 'rgba(255,255,255,.06)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9D9DA1' }}>No logo</div>
            )}
            <label style={{ ...S.btn, fontSize: 11, opacity: logoUploading ? 0.5 : 1, cursor: logoUploading ? 'wait' : 'pointer' }}>
              {logoUploading ? 'Uploading...' : 'Upload Logo'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={S.label}>Legal Name</label><input style={S.input} value={brandingShop.name || ''} onChange={e => setBrandingShop({ ...brandingShop, name: e.target.value })} /></div>
            <div><label style={S.label}>DBA / Display Name</label><input style={S.input} value={brandingShop.dba || ''} onChange={e => setBrandingShop({ ...brandingShop, dba: e.target.value })} /></div>
            <div><label style={S.label}>Phone</label><input style={S.input} value={brandingShop.phone || ''} onChange={e => setBrandingShop({ ...brandingShop, phone: e.target.value })} /></div>
            <div><label style={S.label}>Email</label><input style={S.input} type="email" value={brandingShop.email || ''} onChange={e => setBrandingShop({ ...brandingShop, email: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={S.label}>Website</label><input style={S.input} value={brandingShop.website || ''} onChange={e => setBrandingShop({ ...brandingShop, website: e.target.value })} placeholder="https://" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={S.label}>Address</label><input style={S.input} value={brandingShop.address || ''} onChange={e => setBrandingShop({ ...brandingShop, address: e.target.value })} /></div>
            <div><label style={S.label}>City</label><input style={S.input} value={brandingShop.city || ''} onChange={e => setBrandingShop({ ...brandingShop, city: e.target.value })} /></div>
            <div><label style={S.label}>State</label><input style={S.input} value={brandingShop.state || ''} onChange={e => setBrandingShop({ ...brandingShop, state: e.target.value })} /></div>
            <div><label style={S.label}>ZIP</label><input style={S.input} value={brandingShop.zip || ''} onChange={e => setBrandingShop({ ...brandingShop, zip: e.target.value })} /></div>
          </div>

          <label style={S.label}>Invoice Footer</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={brandingShop.invoice_footer || ''} onChange={e => setBrandingShop({ ...brandingShop, invoice_footer: e.target.value })} placeholder="Appears at the bottom of invoices" />

          <label style={S.label}>Email Footer</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={brandingShop.email_footer || ''} onChange={e => setBrandingShop({ ...brandingShop, email_footer: e.target.value })} placeholder="Appears at the bottom of emails" />

          <button style={{ ...S.btn, marginTop: 16 }} onClick={saveBranding} disabled={brandingSaving}>
            {brandingSaving ? 'Saving...' : 'Save Branding'}
          </button>
        </div>
      </div>
    )
  }

  // Data Retention
  if (activeSection === 'data_retention') {
    const retentionOptions = [
      { value: 'never', label: 'Never' },
      { value: '3_years', label: '3 years' },
      { value: '5_years', label: '5 years' },
      { value: '7_years', label: '7 years' },
      { value: '10_years', label: '10 years' },
    ]
    return (
      <div style={S.page}>
        {backBar}
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Data Retention Policy</div>
        <div style={S.card}>
          <div>
            <label style={S.label}>Auto-flag inactive customers after</label>
            <select style={S.input} value={retentionPolicy.inactive_customers} onChange={e => setRetentionPolicy({ ...retentionPolicy, inactive_customers: e.target.value })}>
              {retentionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Archive completed work orders after</label>
            <select style={S.input} value={retentionPolicy.completed_work_orders} onChange={e => setRetentionPolicy({ ...retentionPolicy, completed_work_orders: e.target.value })}>
              {retentionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Archive closed invoices after</label>
            <select style={S.input} value={retentionPolicy.closed_invoices} onChange={e => setRetentionPolicy({ ...retentionPolicy, closed_invoices: e.target.value })}>
              {retentionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button style={{ ...S.btn, marginTop: 16 }} onClick={saveRetentionPolicy} disabled={retentionSaving}>
            {retentionSaving ? 'Saving...' : 'Save Retention Policy'}
          </button>
          <div style={{ fontSize: 11, color: '#9D9DA1', marginTop: 12, lineHeight: 1.5 }}>
            These settings define your shop&#39;s data retention policy. Actual archival runs automatically based on these rules.
          </div>
        </div>
      </div>
    )
  }

  // Two-Factor Authentication
  if (activeSection === 'security') {
    const TWO_FA_ROLES = ['owner', 'gm', 'it_person', 'accountant', 'office_admin']
    const canSetup2FA = TWO_FA_ROLES.includes(user?.role)

    async function startSetup() {
      setTfaLoading(true); setTfaMsg('')
      const res = await fetch('/api/auth/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup' }) })
      if (res.ok) { const d = await res.json(); setTfaQR(d.qr); setTfaSecret(d.secret) }
      else setTfaMsg('Failed to generate 2FA secret.')
      setTfaLoading(false)
    }

    async function verifyCode() {
      if (tfaCode.length !== 6) { setTfaMsg('Enter a 6-digit code.'); return }
      setTfaLoading(true); setTfaMsg('')
      const res = await fetch('/api/auth/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', code: tfaCode }) })
      if (res.ok) { setTfaStatus({ enabled: true, verified_at: new Date().toISOString() }); setTfaQR(null); setTfaCode(''); setTfaMsg('2FA enabled successfully.') }
      else { const d = await res.json(); setTfaMsg(d.error || 'Invalid code.') }
      setTfaLoading(false)
    }

    async function disable2FA() {
      setTfaLoading(true)
      await fetch('/api/auth/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disable' }) })
      setTfaStatus({ enabled: false, verified_at: null }); setTfaMsg('2FA disabled.')
      setTfaLoading(false)
    }

    return (
      <div style={S.page}>
        {backBar}
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Two-Factor Authentication</div>
        {!canSetup2FA ? (
          <div style={S.card}>
            <div style={{ color: '#9D9DA1', fontSize: 13, padding: 20, textAlign: 'center' }}>
              2FA is available for Owner and Accounting roles only.
            </div>
          </div>
        ) : (
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Status</div>
                <div style={{ fontSize: 12, color: tfaStatus?.enabled ? '#1DB870' : '#7C8BA0', marginTop: 4, fontWeight: 600 }}>
                  {tfaStatus?.enabled ? 'Enabled' : 'Not enabled'}
                </div>
              </div>
              {tfaStatus?.enabled ? (
                <button onClick={disable2FA} disabled={tfaLoading} style={{ padding: '8px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Disable 2FA
                </button>
              ) : !tfaQR ? (
                <button onClick={startSetup} disabled={tfaLoading} style={{ ...S.btn, padding: '8px 16px' }}>
                  {tfaLoading ? 'Loading...' : 'Enable 2FA'}
                </button>
              ) : null}
            </div>

            {tfaQR && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 16 }}>
                <div style={{ fontSize: 13, color: '#EDEDF0', marginBottom: 12 }}>
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
                </div>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <img src={tfaQR} alt="2FA QR Code" style={{ width: 200, height: 200, borderRadius: 8, background: '#fff', padding: 8 }} />
                </div>
                <div style={{ fontSize: 11, color: '#7C8BA0', marginBottom: 16, textAlign: 'center' }}>
                  Or enter manually: <code style={{ fontFamily: "'IBM Plex Mono', monospace", background: 'rgba(255,255,255,.06)', padding: '2px 6px', borderRadius: 4, fontSize: 11, letterSpacing: '.05em' }}>{tfaSecret}</code>
                </div>
                <div style={{ fontSize: 13, color: '#EDEDF0', marginBottom: 8 }}>Enter the 6-digit code to verify:</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={tfaCode} onChange={e => setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6}
                    style={{ ...S.input, width: 120, textAlign: 'center', letterSpacing: '.2em', fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700 }} />
                  <button onClick={verifyCode} disabled={tfaLoading || tfaCode.length !== 6} style={{ ...S.btn, padding: '8px 16px' }}>
                    {tfaLoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </div>
              </div>
            )}

            {tfaMsg && (
              <div style={{ marginTop: 12, fontSize: 12, color: tfaMsg.includes('success') || tfaMsg.includes('enabled') ? '#1DB870' : tfaMsg.includes('disabled') ? '#7C8BA0' : '#EF4444' }}>
                {tfaMsg}
              </div>
            )}
          </div>
        )}
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
