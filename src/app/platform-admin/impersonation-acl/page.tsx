'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

type Owner = { id: string; full_name: string | null; email: string | null }
type Shop = { id: string; name: string | null }
type Row = {
  user_id: string
  shop_id: string
  granted_by: string | null
  granted_at: string
  revoked_at: string | null
  reason: string | null
  user: Owner | null
  shop: Shop | null
}

export default function ImpersonationAclPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [ownerFilter, setOwnerFilter] = useState('')
  const [shopFilter, setShopFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'revoked' | 'all'>('active')
  const [grantOwner, setGrantOwner] = useState('')
  const [grantShop, setGrantShop] = useState('')
  const [grantReason, setGrantReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (ownerFilter) params.set('user_id', ownerFilter)
    if (shopFilter) params.set('shop_id', shopFilter)
    params.set('status', statusFilter)
    const res = await fetch(`/api/platform-admin/impersonation-acl?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setRows(data.rows || [])
      setOwners(data.owners || [])
      setShops(data.shops || [])
    } else {
      const e = await res.json().catch(() => ({}))
      setMsg({ text: e.error || `List failed (HTTP ${res.status})`, kind: 'err' })
    }
  }, [ownerFilter, shopFilter, statusFilter])

  useEffect(() => {
    async function init() {
      const u = await getCurrentUser(supabase)
      if (!u) { window.location.href = '/login'; return }
      if (!u.is_platform_owner) { window.location.href = '/403'; return }
      setUser(u)
      await load()
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => { if (user) load() }, [ownerFilter, shopFilter, statusFilter])

  async function grant(userId: string, shopId: string, reason: string) {
    setBusy(true); setMsg(null)
    const res = await fetch('/api/platform-admin/impersonation-acl', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, shop_id: shopId, reason: reason || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) setMsg({ text: data.reactivated ? 'Access reactivated.' : 'Access granted.', kind: 'ok' })
    else setMsg({ text: data.error || `Grant failed (HTTP ${res.status})`, kind: 'err' })
    setBusy(false)
    await load()
  }

  async function revoke(userId: string, shopId: string) {
    if (!confirm('Revoke this impersonation grant?')) return
    setBusy(true); setMsg(null)
    const res = await fetch('/api/platform-admin/impersonation-acl/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, shop_id: shopId }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) setMsg({ text: data.alreadyRevoked ? 'Already revoked.' : 'Access revoked.', kind: 'ok' })
    else setMsg({ text: data.error || `Revoke failed (HTTP ${res.status})`, kind: 'err' })
    setBusy(false)
    await load()
  }

  async function submitGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!grantOwner || !grantShop) { setMsg({ text: 'Select owner and shop.', kind: 'err' }); return }
    await grant(grantOwner, grantShop, grantReason.trim())
    setGrantReason('')
  }

  if (loading || !user) return <div style={{ color: 'var(--tz-textSecondary)', fontSize: 13, padding: 40 }}>Loading...</div>

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
  const ownerLabel = (o: Owner | null) => o ? (o.full_name || o.email || o.id.slice(0, 8)) : '—'

  const selectStyle: React.CSSProperties = { background: 'var(--tz-bgInput)', border: '1px solid var(--tz-border)', color: 'var(--tz-text)', padding: '6px 10px', borderRadius: 6, fontSize: 12 }
  const btn = (color: string): React.CSSProperties => ({ background: color, color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 })
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 10, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", borderBottom: '1px solid var(--tz-border)', fontWeight: 600 }
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 12, color: 'var(--tz-text)', borderBottom: '1px solid var(--tz-border)' }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tz-text)', margin: '0 0 8px' }}>Impersonation ACL</h1>
      <p style={{ fontSize: 12, color: 'var(--tz-textSecondary)', margin: '0 0 24px' }}>
        Per-shop grants controlling which platform owners may impersonate into which shops. Revoke takes effect on the next impersonation start.
      </p>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, background: msg.kind === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(217,79,79,0.12)', color: msg.kind === 'ok' ? '#22C55E' : '#D94F4F' }}>
          {msg.text}
        </div>
      )}

      {/* Grant form */}
      <div style={{ background: 'var(--tz-bgCard)', border: '1px solid var(--tz-border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)', margin: '0 0 14px' }}>Grant Access</h2>
        <form onSubmit={submitGrant} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={grantOwner} onChange={e => setGrantOwner(e.target.value)} style={selectStyle}>
            <option value="">Platform Owner…</option>
            {owners.map(o => <option key={o.id} value={o.id}>{ownerLabel(o)}{o.email ? ` (${o.email})` : ''}</option>)}
          </select>
          <select value={grantShop} onChange={e => setGrantShop(e.target.value)} style={selectStyle}>
            <option value="">Shop…</option>
            {shops.map(sh => <option key={sh.id} value={sh.id}>{sh.name || sh.id.slice(0, 8)}</option>)}
          </select>
          <input value={grantReason} onChange={e => setGrantReason(e.target.value)} placeholder="Reason (optional)" style={{ ...selectStyle, minWidth: 220 }} />
          <button type="submit" disabled={busy} style={btn('var(--tz-accent)')}>Grant / Reactivate</button>
        </form>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={selectStyle}>
          <option value="">All Owners</option>
          {owners.map(o => <option key={o.id} value={o.id}>{ownerLabel(o)}</option>)}
        </select>
        <select value={shopFilter} onChange={e => setShopFilter(e.target.value)} style={selectStyle}>
          <option value="">All Shops</option>
          {shops.map(sh => <option key={sh.id} value={sh.id}>{sh.name || sh.id.slice(0, 8)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={selectStyle}>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--tz-bgCard)', border: '1px solid var(--tz-border)', borderRadius: 12, padding: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Owner', 'Email', 'Shop', 'Status', 'Granted', 'Reason', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const active = r.revoked_at === null
              return (
                <tr key={`${r.user_id}:${r.shop_id}`}>
                  <td style={td}>{ownerLabel(r.user)}</td>
                  <td style={{ ...td, color: 'var(--tz-textSecondary)' }}>{r.user?.email || '—'}</td>
                  <td style={td}>{r.shop?.name || r.shop_id.slice(0, 8)}</td>
                  <td style={td}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#22C55E' : '#D94F4F', background: active ? 'rgba(34,197,94,.12)' : 'rgba(217,79,79,.12)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                      {active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td style={{ ...td, color: 'var(--tz-textTertiary)' }}>{fmtDate(r.granted_at)}</td>
                  <td style={{ ...td, color: 'var(--tz-textSecondary)' }}>{r.reason || '—'}</td>
                  <td style={td}>
                    {active
                      ? <button disabled={busy} onClick={() => revoke(r.user_id, r.shop_id)} style={btn('#D94F4F')}>Revoke</button>
                      : <button disabled={busy} onClick={() => grant(r.user_id, r.shop_id, '')} style={btn('#22C55E')}>Reactivate</button>
                    }
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--tz-textTertiary)', fontSize: 12 }}>No rows match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
