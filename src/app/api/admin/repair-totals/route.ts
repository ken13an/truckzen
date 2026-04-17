import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
/**
 * One-time backfill: recalculate stale service_orders + invoices totals
 * Uses same canonical calculation as WO Invoice tab (calcWoOperationalTotals)
 * Safe: only updates total fields, does not mutate line items or status
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { ADMIN_ROLES } from '@/lib/roles'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!(actor.is_platform_owner && !actor.impersonate_role) && !ADMIN_ROLES.includes(actor.impersonate_role || actor.role)) {
    return jsonError('Admin only', 403)
  }

  const s = db()
  const shopId = actor.shop_id

  // Get all non-historical, non-deleted WOs for this shop
  const { data: wos } = await s.from('service_orders')
    .select('id')
    .eq('shop_id', shopId)
    .or('is_historical.is.null,is_historical.eq.false')
    .is('deleted_at', null)

  if (!wos || wos.length === 0) return NextResponse.json({ repaired: 0 })

  // Get shop rates
  const { data: shop } = await s.from('shops').select('labor_rate, default_labor_rate, tax_rate, tax_labor').eq('id', shopId).single()
  const laborRate = shop?.labor_rate || shop?.default_labor_rate || DEFAULT_LABOR_RATE_FALLBACK
  const taxRate = shop?.tax_rate || 0
  const taxLabor = !!shop?.tax_labor

  let repaired = 0

  for (const wo of wos) {
    const { data: lines } = await s.from('so_lines')
      .select('line_type, quantity, unit_price, parts_sell_price, parts_status, billed_hours, actual_hours, estimated_hours')
      .eq('so_id', wo.id)

    if (!lines || lines.length === 0) continue

    // Same calculation as calcWoOperationalTotals
    const laborTotal = lines.filter(l => l.line_type === 'labor').reduce((sum, l) => {
      const hrs = l.billed_hours || l.actual_hours || l.estimated_hours || 0
      return sum + (hrs * laborRate)
    }, 0)

    const partsTotal = lines.filter(l => l.line_type === 'part' && l.parts_status !== 'canceled').reduce((sum, l) => {
      const sell = l.parts_sell_price || l.unit_price || 0
      return sum + (sell * (l.quantity || 1))
    }, 0)

    const subtotal = laborTotal + partsTotal
    const taxableAmount = partsTotal + (taxLabor ? laborTotal : 0)
    const taxAmount = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0
    const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100

    // Update service_orders
    await s.from('service_orders').update({
      labor_total: Math.round(laborTotal * 100) / 100,
      parts_total: Math.round(partsTotal * 100) / 100,
      grand_total: grandTotal,
    }).eq('id', wo.id)

    // Update linked invoice if exists
    const { data: inv } = await s.from('invoices').select('id').eq('so_id', wo.id).limit(1).single()
    if (inv) {
      await s.from('invoices').update({
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: grandTotal,
      }).eq('id', inv.id)
    }

    repaired++
  }

  return NextResponse.json({ repaired, message: `Repaired ${repaired} work orders` })
}
