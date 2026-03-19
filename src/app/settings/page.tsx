'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { LogOut, UserPlus, ExternalLink, Copy } from 'lucide-react'

const TABS = ['Shop', 'Users', 'Integrations', 'Notifications', 'Billing']

export default function SettingsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState('Shop')
  const [shop, setShop] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      if (!['owner', 'gm', 'it_person', 'office_admin'].includes(profile.role)) { window.location.href = '/dashboard'; return }
      setUser(profile)
      const { data } = await supabase.from('shops').select('*').eq('id', profile.shop_id).single()
      if (data) setShop(data)
    }
    load()
  }, [])

  async function saveShop() {
    setSaving(true)
    await supabase.from('shops').update({ name: shop.name, dba: shop.dba, phone: shop.phone, email: shop.email, address: shop.address }).eq('id', shop.id)
    setSaving(false)
  }

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-5">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-brand-border pb-0">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold transition-colors duration-150 border-b-2 ${tab === t ? 'text-teal border-teal' : 'text-text-tertiary border-transparent hover:text-text-secondary'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Shop tab */}
      {tab === 'Shop' && (
        <div className="bg-surface border border-brand-border rounded-lg p-5 max-w-xl">
          <h3 className="text-sm font-bold text-text-primary mb-4">Shop Information</h3>
          {[
            { label: 'Legal Name', key: 'name' },
            { label: 'DBA / Display Name', key: 'dba' },
            { label: 'Phone', key: 'phone' },
            { label: 'Email', key: 'email', type: 'email' },
            { label: 'Address', key: 'address' },
          ].map(f => (
            <div key={f.key} className="mb-3">
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono mb-1 block">{f.label}</label>
              <input
                type={f.type ?? 'text'}
                className="w-full px-3 py-2 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors duration-150"
                value={(shop as any)?.[f.key] ?? ''}
                onChange={e => setShop((s: any) => ({ ...s, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <button onClick={saveShop} disabled={saving}
            className="mt-2 px-5 py-2.5 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors duration-150 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {/* Kiosk */}
          <div className="mt-6 pt-5 border-t border-brand-border">
            <h3 className="text-sm font-bold text-text-primary mb-2">Kiosk Mode</h3>
            <p className="text-xs text-text-secondary mb-3">Open the self-service check-in kiosk on a tablet in your waiting area.</p>
            <div className="flex gap-2">
              <a href={`/kiosk?shop=${shop.id}`} target="_blank" rel="noopener"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors duration-150 no-underline">
                <ExternalLink size={14} strokeWidth={1.5} /> Open Kiosk
              </a>
              <button onClick={() => { navigator.clipboard.writeText(`https://truckzen.pro/kiosk?shop=${shop.id}`) }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-2 border border-brand-border text-text-secondary rounded-md text-sm hover:text-text-primary transition-colors duration-150">
                <Copy size={14} strokeWidth={1.5} /> Copy URL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users tab */}
      {tab === 'Users' && (
        <div className="bg-surface border border-brand-border rounded-lg p-5 max-w-xl">
          <h3 className="text-sm font-bold text-text-primary mb-2">Staff Accounts</h3>
          <p className="text-xs text-text-secondary mb-4">Manage user roles, teams, and Telegram IDs.</p>
          <a href="/settings/users" className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-2 border border-brand-border text-text-secondary rounded-md text-sm font-semibold hover:text-text-primary transition-colors duration-150 no-underline mr-2">
            View Staff List
          </a>
          <a href="/settings/users/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors duration-150 no-underline">
            <UserPlus size={14} strokeWidth={1.5} /> Invite Staff Member
          </a>
        </div>
      )}

      {/* Integrations tab */}
      {tab === 'Integrations' && (
        <div className="bg-surface border border-brand-border rounded-lg p-5 max-w-xl">
          <h3 className="text-sm font-bold text-text-primary mb-4">Connected Services</h3>
          {[
            { name: 'Stripe', desc: 'Payment processing' },
            { name: 'QuickBooks Online', desc: 'Accounting sync' },
            { name: 'Twilio', desc: 'SMS notifications' },
            { name: 'FinditParts', desc: 'Parts catalog' },
            { name: 'Samsara GPS', desc: 'Fleet tracking' },
          ].map(int => (
            <div key={int.name} className="flex items-center justify-between py-3 border-b border-brand-border/50">
              <div>
                <div className="text-sm font-semibold text-text-primary">{int.name}</div>
                <div className="text-xs text-text-tertiary">{int.desc}</div>
              </div>
              <button className="px-3 py-1.5 bg-teal/10 border border-teal/25 text-teal rounded-md text-xs font-bold hover:bg-teal/20 transition-colors duration-150">
                Connect
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Other tabs */}
      {!['Shop', 'Users', 'Integrations'].includes(tab) && (
        <p className="text-sm text-text-secondary">{tab} settings coming soon.</p>
      )}

      {/* Account & Security */}
      <div className="bg-surface border border-brand-border rounded-lg p-5 max-w-xl mt-8">
        <h3 className="text-sm font-bold text-text-primary mb-4">Account and Security</h3>
        <div className="flex flex-col gap-2 mb-5">
          {[
            { label: 'Logged in as', value: user?.email },
            { label: 'Role', value: user?.role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), cls: 'text-teal' },
            { label: 'Company', value: shop?.dba ?? shop?.name ?? '—' },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-sm">
              <span className="text-text-secondary">{r.label}</span>
              <span className={`font-semibold ${r.cls ?? 'text-text-primary'}`}>{r.value ?? '—'}</span>
            </div>
          ))}
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-error text-white rounded-md text-sm font-bold hover:opacity-90 transition-opacity duration-150">
          <LogOut size={16} strokeWidth={1.5} /> Sign Out
        </button>
      </div>
    </div>
  )
}
