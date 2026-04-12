'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Search, LogIn } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function PlatformImpersonate() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [shops, setShops] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) return
      setUser(u)
      await fetchShops(u.id)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchShops(userId: string, s?: string) {
    const params = new URLSearchParams({ user_id: userId })
    if (s) params.set('search', s)
    const res = await fetch(`/api/platform-admin/shops?${params}`)
    if (res.ok) setShops(await res.json())
  }

  async function handleSearch(val: string) {
    setSearch(val)
    if (user) await fetchShops(user.id, val)
  }

  async function handleEnter(shop: any) {
    if (!user) return
    localStorage.setItem('tz_original_shop_id', user.shop_id)
    const res = await fetch('/api/platform-admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, shop_id: shop.id, action: 'start' }),
    })
    if (res.ok) window.location.href = '/dashboard'
  }

  if (loading) return <div style={{ color: t.textSecondary, fontSize: 13, padding: 40 }}>Loading...</div>

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: '0 0 8px' }}>Impersonate / Enter Shop</h1>
      <p style={{ fontSize: 12, color: t.textSecondary, margin: '0 0 24px' }}>Enter a shop as its owner to see exactly what they see and troubleshoot issues.</p>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 480, marginBottom: 24 }}>
        <Search size={14} color={t.textTertiary} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search shop by name or owner email..."
          autoFocus
          style={{ width: '100%', padding: '12px 14px 12px 38px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, fontSize: 13, color: t.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shops.map(shop => (
          <div key={shop.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{shop.name}</div>
              <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{shop.owner_name} &middot; {shop.owner_email}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: shop.status === 'active' ? '#22C55E' : '#D94F4F', background: shop.status === 'active' ? 'rgba(34,197,94,.12)' : 'rgba(217,79,79,.12)', padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase' }}>{shop.status}</span>
            <button onClick={() => handleEnter(shop)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1D6FE8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <LogIn size={13} /> Enter as Owner
            </button>
          </div>
        ))}
        {shops.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: t.textTertiary, fontSize: 12 }}>
            {search ? 'No shops match your search' : 'No shops found'}
          </div>
        )}
      </div>
    </div>
  )
}
