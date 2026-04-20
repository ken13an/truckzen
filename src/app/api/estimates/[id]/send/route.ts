import { NextResponse } from 'next/server'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { requireRouteContext } from '@/lib/api-route-auth'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'
import { rateLimit } from '@/lib/ratelimit/core'
import { generateEstimatePdf } from '@/lib/pdf/generateEstimatePdf'

async function getEstimateForActor(admin: any, actor: any, id: string) {
  let q = admin.from('estimates').select('*').eq('id', id)
  if (!actor.is_platform_owner && actor.effective_shop_id) q = q.eq('shop_id', actor.effective_shop_id)
  const { data, error } = await q.single()
  return { data, error }
}

function esc(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function money(n: any): string {
  const v = Number(n)
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
}

async function _POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireRouteContext([...INVOICE_ACTION_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const sendLimit = await rateLimit('estimate-send-user', ctx.actor.id)
  if (!sendLimit.allowed) return NextResponse.json({ error: 'Too many estimate requests' }, { status: 429 })
  const { data: estimate, error } = await getEstimateForActor(ctx.admin, ctx.actor, id)
  if (error || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  const { data: lines } = await ctx.admin.from('estimate_lines').select('*').eq('estimate_id', id).order('line_number')
  const now = new Date().toISOString()
  const validUntil = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  const sentVia: string[] = []
  await ctx.admin.from('estimates').update({ status: 'sent', sent_at: now, valid_until: validUntil, updated_at: now }).eq('id', id)
  const repairOrderId = (estimate as any).repair_order_id || (estimate as any).wo_id
  if (repairOrderId) await ctx.admin.from('service_orders').update({ estimate_status: 'sent', updated_at: now }).eq('id', repairOrderId)

  const shop = await getShopInfo((estimate as any).shop_id)

  // Pull richer shop + WO + customer + asset detail for the email body.
  const { data: shopRow } = await ctx.admin.from('shops').select('name, dba, phone, email, address, city, state, zip, tax_rate').eq('id', (estimate as any).shop_id).single()
  let woRow: any = null
  let assetRow: any = null
  let customerRow: any = null
  if (repairOrderId) {
    const { data: so } = await ctx.admin
      .from('service_orders')
      .select('so_number, complaint, assets(unit_number, year, make, model, vin, odometer), customers(company_name, contact_name, phone, email)')
      .eq('id', repairOrderId).single()
    woRow = so || null
    assetRow = (so as any)?.assets || null
    customerRow = (so as any)?.customers || null
  }

  // Pull so_lines referenced by estimate lines to enrich with part_number/quantity/unit_price/rough_name.
  const refIds = (lines || []).map((l: any) => l.repair_order_line_id).filter(Boolean)
  let soLineMap: Record<string, any> = {}
  if (refIds.length) {
    const { data: soLines } = await ctx.admin
      .from('so_lines')
      .select('id, part_number, quantity, unit_price, parts_sell_price, rough_name, line_type')
      .in('id', refIds)
    for (const r of soLines || []) soLineMap[r.id] = r
  }

  const portalLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/estimate/${(estimate as any).approval_token}`
  const pdfLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/api/estimates/${id}/pdf?token=${(estimate as any).approval_token}`

  let truckInfo = ''
  if (assetRow) {
    truckInfo = `Unit #${assetRow.unit_number} - ${assetRow.year || ''} ${assetRow.make || ''} ${assetRow.model || ''}`.trim()
  }

  const linesHtml = (lines || []).map((l: any) => {
    const so = l.repair_order_line_id ? soLineMap[l.repair_order_line_id] : null
    const partNumber = so?.part_number || ''
    const srcQty = so?.quantity ?? null
    const unitPrice = so?.parts_sell_price ?? so?.unit_price ?? null
    const laborTotal = Number(l.labor_total) || 0
    const partsTotal = Number(l.parts_total) || 0
    const isLabor = laborTotal > 0 && partsTotal === 0
    const isPart = partsTotal > 0 && laborTotal === 0
    // Qty/Hrs column: hours for labor rows, quantity for part rows
    const qtyHrsLabel = isLabor
      ? (Number(l.labor_hours) > 0 ? `${l.labor_hours} hr` : '—')
      : (srcQty != null && Number(srcQty) > 0 ? String(srcQty) : '—')
    // Unit-price sub-line under description for part rows: "Qty 4 × $125.00"
    const unitPriceSub = isPart && srcQty != null && Number(srcQty) > 0 && unitPrice != null && Number(unitPrice) > 0
      ? `<div style="font-size:11px;color:#8a8a9a;margin-top:2px">Qty ${esc(srcQty)} × $${money(unitPrice)}</div>`
      : ''
    return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px;vertical-align:top;line-height:1.4">
        <div>${esc(l.description)}</div>
        ${partNumber ? `<div style="font-size:11px;color:#8a8a9a;margin-top:2px">Part # ${esc(partNumber)}</div>` : ''}
        ${unitPriceSub}
        ${so?.rough_name && !partNumber ? `<div style="font-size:11px;color:#D97706;margin-top:2px">~ ${esc(so.rough_name)}</div>` : ''}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:center;vertical-align:top;white-space:nowrap">${qtyHrsLabel}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right;vertical-align:top;white-space:nowrap">${isLabor ? '$' + money(laborTotal) : '—'}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right;vertical-align:top;white-space:nowrap">${isPart ? '$' + money(partsTotal) : '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px;font-weight:700;text-align:right;vertical-align:top;white-space:nowrap">$${money(l.line_total || l.total)}</td>
    </tr>
  `
  }).join('')

  if ((estimate as any).customer_email) {
    const shopName = shopRow?.dba || shopRow?.name || shop.name || 'TruckZen'
    const shopAddrLines: string[] = []
    if (shopRow?.address) shopAddrLines.push(esc(shopRow.address))
    const cityLine = [shopRow?.city, shopRow?.state, shopRow?.zip].filter(Boolean).join(' ').trim()
    if (cityLine) shopAddrLines.push(esc(cityLine))
    if (shopRow?.phone) shopAddrLines.push(esc(shopRow.phone))
    if (shopRow?.email) shopAddrLines.push(esc(shopRow.email))

    const customerName = customerRow?.company_name || (estimate as any).customer_name || 'Customer'
    const customerContact = customerRow?.contact_name ? `<div style="font-size:12px;color:#8a8a9a">${esc(customerRow.contact_name)}</div>` : ''
    const customerPhone = customerRow?.phone ? `<div style="font-size:12px;color:#8a8a9a">${esc(customerRow.phone)}</div>` : ''
    const customerEmail = customerRow?.email || (estimate as any).customer_email
    const customerEmailHtml = customerEmail ? `<div style="font-size:12px;color:#8a8a9a">${esc(customerEmail)}</div>` : ''

    const vinLine = assetRow?.vin ? `<div style="font-size:11px;color:#8a8a9a;font-family:monospace">VIN: ${esc(assetRow.vin)}</div>` : ''
    const odoLine = assetRow?.odometer ? `<div style="font-size:12px;color:#8a8a9a">${Number(assetRow.odometer).toLocaleString()} miles</div>` : ''

    const taxRate = (estimate as any).tax_rate ?? shopRow?.tax_rate ?? 0
    const subtotal = Number((estimate as any).subtotal ?? ((Number((estimate as any).labor_total) || 0) + (Number((estimate as any).parts_total) || 0)))
    const taxAmount = Number((estimate as any).tax_amount) || 0
    const grandTotal = Number((estimate as any).total ?? (estimate as any).grand_total ?? 0)
    const validUntilLabel = new Date(validUntil).toLocaleString()
    const woNumber = woRow?.so_number || ''

    const emailHtml = `<div style="background:#0f0f1a;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#1a1a2e;border-radius:12px;overflow:hidden">
    <div style="padding:24px;background:#1d1d35;border-bottom:1px solid #2a2a3a;display:flex;justify-content:space-between;flex-wrap:wrap">
      <div>
        <h1 style="margin:0;color:#ffffff;font-size:20px">${esc(shopName)}</h1>
        ${shopAddrLines.map(l => `<div style="margin-top:4px;color:#8a8a9a;font-size:12px">${l}</div>`).join('')}
      </div>
      <div style="text-align:right">
        <div style="color:#ffffff;font-size:16px;font-weight:700">Estimate ${esc((estimate as any).estimate_number)}</div>
        ${woNumber ? `<div style="color:#8a8a9a;font-size:12px;margin-top:4px">WO ${esc(woNumber)}</div>` : ''}
        <div style="color:#8a8a9a;font-size:12px;margin-top:4px">Sent ${esc(new Date(now).toLocaleString())}</div>
        <div style="color:#8a8a9a;font-size:12px;margin-top:2px">Valid until ${esc(validUntilLabel)}</div>
      </div>
    </div>

    <div style="padding:20px 24px;background:#16162a;border-bottom:1px solid #2a2a3a;display:flex;flex-wrap:wrap;gap:16px">
      <div style="flex:1;min-width:200px">
        <div style="color:#8a8a9a;font-size:10px;text-transform:uppercase;letter-spacing:0.05em">Customer</div>
        <div style="color:#ffffff;font-size:14px;font-weight:700;margin-top:4px">${esc(customerName)}</div>
        ${customerContact}
        ${customerPhone}
        ${customerEmailHtml}
      </div>
      <div style="flex:1;min-width:200px">
        <div style="color:#8a8a9a;font-size:10px;text-transform:uppercase;letter-spacing:0.05em">Vehicle</div>
        <div style="color:#ffffff;font-size:14px;font-weight:700;margin-top:4px">${esc(truckInfo || '—')}</div>
        ${vinLine}
        ${odoLine}
      </div>
    </div>

    <div style="padding:24px">
      <p style="color:#e0e0e0;font-size:14px;margin:0 0 8px">Hi ${esc((estimate as any).customer_name || customerRow?.contact_name || 'Customer')},</p>
      <p style="color:#b0b0c0;font-size:13px;margin:0 0 16px">Here is your repair estimate${truckInfo ? ` for <strong style="color:#e0e0e0">${esc(truckInfo)}</strong>` : ''}. Review the details below and approve to authorize the work.</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;table-layout:auto">
        <thead>
          <tr style="background:#15152a">
            <th style="padding:8px 12px;text-align:left;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Description</th>
            <th style="padding:8px 8px;text-align:center;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">Qty / Hrs</th>
            <th style="padding:8px 8px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Labor</th>
            <th style="padding:8px 8px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Parts</th>
            <th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Total</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
      </table>

      <div style="text-align:right;padding:12px 0;border-top:1px solid #2a2a3a">
        <div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Subtotal: $${money(subtotal)}</div>
        <div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Tax${taxRate ? ` (${esc(taxRate)}%)` : ''}: $${money(taxAmount)}</div>
        <div style="color:#ffffff;font-size:18px;font-weight:800">Total: $${money(grandTotal)}</div>
      </div>

      <div style="margin:20px 0;padding:14px 16px;background:#15152a;border-radius:8px;font-size:12px;color:#b0b0c0;line-height:1.5">
        <strong style="color:#e0e0e0">How to approve:</strong> Click the button below to review and digitally approve the estimate. Once approved, the shop is authorized to begin the listed work. If any additional repairs are discovered, you will be notified before they are performed.
      </div>

      <div style="text-align:center;margin:24px 0 8px">
        <a href="${portalLink}" style="display:inline-block;padding:14px 32px;background:#16A34A;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700">Review &amp; Approve Estimate</a>
      </div>

      <div style="text-align:center;margin:8px 0 16px">
        <a href="${pdfLink}" style="color:#1D6FE8;font-size:13px;text-decoration:underline">View / Print Estimate</a>
      </div>

      <p style="color:#8a8a9a;font-size:11px;text-align:center;margin:16px 0 0">This estimate is valid until ${esc(validUntilLabel)}. Parts prices marked with ~ are estimated — final price may vary.</p>
    </div>
  </div>
</div>`
    let attachments: { filename: string; content: Buffer }[] | undefined
    try {
      const pdfResult = await generateEstimatePdf(id)
      if (!pdfResult) {
        console.warn('[Estimates] PDF generator returned null — sending email without attachment', { estimateId: id })
      } else {
        attachments = [{ filename: pdfResult.filename, content: Buffer.from(pdfResult.pdfBytes) }]
      }
    } catch (err: any) {
      console.warn('[Estimates] PDF generation failed — sending email without attachment', { estimateId: id, error: err?.message || String(err) })
    }

    const sent = await sendEmail((estimate as any).customer_email, `Estimate ${(estimate as any).estimate_number} from ${shopName}`, emailHtml, attachments)
    if (sent) {
      sentVia.push('email')
      // Optional: track pdf_sent_at if column exists. Do not fail the send on error.
      const { error: pdfTrackErr } = await ctx.admin.from('estimates').update({ pdf_sent_at: now }).eq('id', id)
      if (pdfTrackErr) console.warn('[Estimates] pdf_sent_at update skipped:', pdfTrackErr.message)
    }
  }
  if ((estimate as any).customer_phone) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromPhone = process.env.TWILIO_PHONE_NUMBER
      if (accountSid && authToken && fromPhone) {
        const twilio = (await import('twilio')).default
        const client = twilio(accountSid, authToken)
        const smsBody = `${shop.name} - Estimate ${(estimate as any).estimate_number}\n${truckInfo ? truckInfo + '\n' : ''}Total: $${money((estimate as any).total || 0)}\n\nReview & approve: ${portalLink}`
        await client.messages.create({ body: smsBody, from: fromPhone, to: (estimate as any).customer_phone })
        sentVia.push('sms')
      }
    } catch (err) {
      console.error('[Estimates] SMS send error:', err)
    }
  }
  if (sentVia.length > 0) await ctx.admin.from('estimates').update({ sent_via: sentVia.join(',') }).eq('id', id)
  return NextResponse.json({ success: true, sent_via: sentVia, portal_link: portalLink, pdf_link: pdfLink })
}

export const POST = safeRoute(_POST)
