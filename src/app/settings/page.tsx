'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const SECTIONS = [
  { key: 'team', label: 'Team Members', href: '/settings/users' },
  { key: 'kiosk', label: 'Kiosk Mode' },
  { key: 'tax', label: 'Tax & Location' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'billing', label: 'Billing' },
  { key: 'shop', label: 'Shop Information' },
  { key: 'branding', label: 'Shop Branding' },
  { key: 'data_retention', label: 'Data Retention' },
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

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      if (!['owner', 'gm', 'it_person', 'office_admin'].includes(profile.role)) { window.location.href = '/dashboard'; return }
      setUser(profile)
      const { data } = await supabase.from('shops').select('*').eq('id', profile.shop_id).single()
      if (data) {
        setShop(data); setEditShop(data); setBrandingShop(data)
        if (data.kiosk_code) setKioskCode(data.kiosk_code)
        if (data.kiosk_enabled != null) setKioskEnabled(data.kiosk_enabled)
        if (data.kiosk_pin) setKioskPin(data.kiosk_pin)
      }
      // Load retention policy
      try {
        const retRes = await fetch(`/api/settings?shop_id=${profile.shop_id}`)
        if (retRes.ok) {
          const retData = await retRes.json()
          if (retData.retention_policy) setRetentionPolicy(retData.retention_policy)
        }
      } catch {}
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
