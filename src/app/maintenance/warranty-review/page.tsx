/**
 * TruckZen — Original Design
 * Warranty Review — maintenance team reviews warranty-flagged WOs
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#4D9EFF', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function WarrantyReviewPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [wos, setWos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionWo, setActionWo] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [dealerName, setDealerName] = useState('')
  const [dealerLocation, setDealerLocation] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadWOs(p.shop_id)
    })
  }, [])

  async function loadWOs(shopId: string) {
    setLoading(true)
    const { data } = await supabase
      .from('service_orders')
      .select('id, so_number, status, complaint, warranty_status, warranty_notes, created_at, assets(unit_number, year, make, model, warranty_provider, warranty_expiry), customers(company_name)')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .neq('status', 'void')
      .eq('warranty_status', 'checking')
      .order('created_at', { ascending: false })
    setWos(data || [])
    setLoading(false)
  }

  async function resolveWarranty(woId: string, decision: string) {
    if (!user) return
    setSaving(true)
    const body: any = { action: 'warranty_decision', user_id: user.id, decision, notes }
    if (decision === 'send_to_dealer') {
      body.dealer_name = dealerName
      body.dealer_location = dealerLocation
    }
    await fetch(`/api/work-orders/${woId}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false); setActionWo(null); setNotes(''); setDealerName(''); setDealerLocation('')
    if (user) await loadWOs(user.shop_id)
  }

  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

  if (loading) return <div style={{ background: t.bg, minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 4 }}>Warranty Review</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>{wos.length} work order{wos.length !== 1 ? 's' : ''} pending warranty verification</div>

      {wos.length === 0 ? (
        <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
          No work orders pending warranty review
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {wos.map(wo => {
            const asset = wo.assets || {}
            const cust = wo.customers || {}
            const age = daysSince(wo.created_at)
            const isUrgent = age > 1
            return (
              <div key={wo.id} style={{ background: '#161B24', border: `1px solid ${isUrgent ? 'rgba(245,158,11,.25)' : 'rgba(255,255,255,.06)'}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <a href={getWorkorderRoute(wo.id, undefined, 'warranty')} style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE, textDecoration: 'none' }}>{wo.so_number}</a>
                      {isUrgent && <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: 'rgba(245,158,11,.12)', color: AMBER }}>{age}d OLD — NEEDS ATTENTION</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>#{asset.unit_number || '—'} {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{cust.company_name || '—'}</div>
                    {wo.complaint && <div style={{ fontSize: 12, color: t.text, marginTop: 6, padding: '6px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 6 }}>{wo.complaint}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {asset.warranty_provider && <div style={{ fontSize: 11, color: AMBER, fontWeight: 600 }}>Warranty: {asset.warranty_provider}</div>}
                    {asset.warranty_expiry && <div style={{ fontSize: 10, color: MUTED }}>Expires: {new Date(asset.warranty_expiry).toLocaleDateString()}</div>}
                  </div>
                </div>

                {/* Action buttons */}
                {actionWo?.id === wo.id ? (
                  <div style={{ padding: 12, background: 'rgba(255,255,255,.03)', borderRadius: 8, marginTop: 8 }}>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." rows={2} style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: FONT, resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
                    {actionWo.decision === 'send_to_dealer' && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input value={dealerName} onChange={e => setDealerName(e.target.value)} placeholder="Dealer name" style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: FONT }} />
                        <input value={dealerLocation} onChange={e => setDealerLocation(e.target.value)} placeholder="Location" style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: FONT }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => resolveWarranty(wo.id, actionWo.decision)} disabled={saving} style={{ padding: '8px 16px', background: actionWo.decision === 'no_warranty' ? '#22C55E' : actionWo.decision === 'local_repair' ? '#1D6FE8' : RED, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                        {saving ? 'Saving...' : 'Confirm'}
                      </button>
                      <button onClick={() => setActionWo(null)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,.06)', color: MUTED, border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => setActionWo({ ...wo, decision: 'no_warranty' })} style={{ padding: '6px 14px', background: 'rgba(34,197,94,.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,.2)', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>No Warranty — Proceed</button>
                    <button onClick={() => setActionWo({ ...wo, decision: 'local_repair' })} style={{ padding: '6px 14px', background: 'rgba(29,111,232,.1)', color: BLUE, border: '1px solid rgba(29,111,232,.2)', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Repair Here (Warranty)</button>
                    <button onClick={() => setActionWo({ ...wo, decision: 'send_to_dealer' })} style={{ padding: '6px 14px', background: 'rgba(217,79,79,.08)', color: RED, border: '1px solid rgba(217,79,79,.2)', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Send to Dealer</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
