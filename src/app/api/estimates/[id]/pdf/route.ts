import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { safeRoute } from '@/lib/api-handler'
import { rateLimit } from '@/lib/ratelimit/core'
import { getRequestIp } from '@/lib/ratelimit/request-ip'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type Params = { params: Promise<{ id: string }> }

async function _GET(req: Request, { params }: Params) {
  const { id } = await params
  const pdfLimit = await rateLimit('estimate-pdf-ip', getRequestIp(req))
  if (!pdfLimit.allowed) return NextResponse.json({ error: 'Too many estimate requests' }, { status: 429 })
  const s = db()

  const { data: est } = await s.from('estimates').select('*, estimate_lines(*)').eq('id', id).single()
  if (!est) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Customer token guard: if no staff session cookie, require matching approval_token.
  // Staff access continues to work via existing session cookie flow.
  const cookieHeader = req.headers.get('cookie') || ''
  const hasSession = /(?:^|;\s*)(tz_session_token|sb-)/.test(cookieHeader)
  if (!hasSession) {
    const token = new URL(req.url).searchParams.get('token') || ''
    const expected = (est as any).approval_token || ''
    if (!token || !expected || token !== expected) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data: wo } = await s.from('service_orders').select('so_number, complaint, ownership_type, assets(unit_number, year, make, model, vin, odometer), customers(company_name, contact_name, phone, email)').eq('id', est.repair_order_id).single()

  const { data: shop } = await s.from('shops').select('name, dba, phone, email, address, city, state, zip, tax_rate').eq('id', est.shop_id).single()

  const asset = (wo?.assets as any) || {}
  const customer = (wo?.customers as any) || {}
  const shopName = shop?.dba || shop?.name || 'TruckZen'
  const lines = est.estimate_lines || []
  const ownerLabel: Record<string, string> = { fleet_asset: 'Company Truck', owner_operator: 'Owner Operator', outside_customer: 'Outside Customer' }

  const hasRoughParts = lines.some((l: any) => l.is_rough)

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #1a1a2e; margin: 0; padding: 32px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 24px; border-bottom: 2px solid #1D6FE8; padding-bottom: 16px; }
  .title { font-size: 28px; font-weight: 800; color: #1D6FE8; }
  .shop-info { text-align: right; font-size: 11px; color: #666; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .meta-box { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; flex: 1; margin: 0 4px; }
  .meta-label { font-size: 9px; text-transform: uppercase; color: #888; letter-spacing: 0.05em; margin-bottom: 4px; }
  .meta-val { font-size: 13px; font-weight: 700; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f1f3f5; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px; text-align: left; color: #666; border-bottom: 2px solid #dee2e6; }
  td { padding: 8px; border-bottom: 1px solid #f0f0f5; font-size: 11px; }
  .totals { text-align: right; margin-top: 16px; }
  .totals td { padding: 4px 8px; }
  .total-row { font-size: 16px; font-weight: 800; color: #1D6FE8; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .approved { background: #d4edda; color: #155724; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #dee2e6; font-size: 10px; color: #888; }
  .rough { color: #D97706; }
</style></head><body>
  <div class="header">
    <div>
      <div class="title">ESTIMATE</div>
      <div style="font-size:13px;color:#666;margin-top:4px">${wo?.so_number || ''}-EST</div>
    </div>
    <div class="shop-info">
      <div style="font-size:14px;font-weight:700;color:#1a1a2e">${shopName}</div>
      ${shop?.address ? `<div>${shop.address}</div>` : ''}
      ${shop?.city ? `<div>${shop.city}, ${shop?.state || ''} ${shop?.zip || ''}</div>` : ''}
      ${shop?.phone ? `<div>${shop.phone}</div>` : ''}
      ${shop?.email ? `<div>${shop.email}</div>` : ''}
    </div>
  </div>

  <div class="meta">
    <div class="meta-box">
      <div class="meta-label">Customer</div>
      <div class="meta-val">${customer.company_name || est.customer_name || '—'}</div>
      ${customer.contact_name ? `<div style="font-size:11px;color:#666">${customer.contact_name}</div>` : ''}
      ${customer.phone ? `<div style="font-size:11px;color:#666">${customer.phone}</div>` : ''}
    </div>
    <div class="meta-box">
      <div class="meta-label">Vehicle</div>
      <div class="meta-val">#${asset.unit_number || '—'} ${asset.year || ''} ${asset.make || ''} ${asset.model || ''}</div>
      ${asset.vin ? `<div style="font-size:10px;color:#888;font-family:monospace">VIN: ${asset.vin}</div>` : ''}
      ${asset.odometer ? `<div style="font-size:11px;color:#666">${asset.odometer.toLocaleString()} miles</div>` : ''}
    </div>
    <div class="meta-box">
      <div class="meta-label">Date</div>
      <div class="meta-val">${new Date(est.created_at).toLocaleDateString()}</div>
      <div style="font-size:11px;color:#666">${ownerLabel[wo?.ownership_type] || ''}</div>
      ${est.status === 'approved' ? '<div class="badge approved" style="margin-top:4px">APPROVED</div>' : ''}
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Description</th><th style="text-align:center">Hours</th><th style="text-align:right">Rate</th><th style="text-align:right">Labor</th><th style="text-align:right">Parts</th><th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>
      ${lines.map((l: any) => `<tr>
        <td>${l.description || ''}${l.complaint ? `<div style="font-size:10px;color:#888">${l.complaint}</div>` : ''}</td>
        <td style="text-align:center;font-family:monospace">${l.labor_hours || '—'}</td>
        <td style="text-align:right;font-family:monospace">$${(l.labor_rate || 0).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">$${(l.labor_total || 0).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">${l.is_rough ? '<span class="rough">~</span>' : ''}$${(l.parts_total || 0).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700">$${(l.line_total || 0).toFixed(2)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  ${hasRoughParts ? '<div style="font-size:10px;color:#D97706;margin-bottom:12px">* Parts prices marked with ~ are estimated — final price may vary.</div>' : ''}

  <table class="totals" style="width:250px;margin-left:auto">
    <tr><td style="color:#666">Subtotal</td><td style="font-family:monospace;font-weight:600">$${(est.labor_total + est.parts_total).toFixed(2)}</td></tr>
    <tr><td style="color:#666">Tax (${est.tax_rate || shop?.tax_rate || 0}%)</td><td style="font-family:monospace">$${(est.tax_amount || 0).toFixed(2)}</td></tr>
    <tr class="total-row"><td>Total</td><td style="font-family:monospace">$${(est.grand_total || 0).toFixed(2)}</td></tr>
  </table>

  ${est.notes ? `<div style="margin-top:16px;padding:12px;background:#f8f9fa;border-radius:6px;font-size:11px"><strong>Notes:</strong> ${est.notes}</div>` : ''}

  <div class="footer">
    This estimate is valid for 30 days. Approval of this estimate authorizes the shop to proceed with the listed work.
  </div>
</body></html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export const GET = safeRoute(_GET)
