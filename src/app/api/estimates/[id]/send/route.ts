import { NextResponse } from 'next/server'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { requireRouteContext } from '@/lib/api-route-auth'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'
import { rateLimit } from '@/lib/ratelimit/core'

async function getEstimateForActor(admin: any, actor: any, id: string) {
  let q = admin.from('estimates').select('*').eq('id', id)
  if (!actor.is_platform_owner && actor.effective_shop_id) q = q.eq('shop_id', actor.effective_shop_id)
  const { data, error } = await q.single()
  return { data, error }
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
  const portalLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/estimate/${(estimate as any).approval_token}`
  let truckInfo = ''
  if (repairOrderId) {
    const { data: so } = await ctx.admin.from('service_orders').select('so_number, assets(unit_number, year, make, model)').eq('id', repairOrderId).single()
    if (so) { const asset = so.assets as any; truckInfo = asset ? `Unit #${asset.unit_number} - ${asset.year} ${asset.make} ${asset.model}` : '' }
  }
  const linesHtml = (lines || []).map((l: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px">${l.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right">$${(l.labor_total || 0).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right">$${(l.parts_total || 0).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px;font-weight:700;text-align:right">$${(l.line_total || l.total || 0).toFixed(2)}</td>
    </tr>
  `).join('')

  if ((estimate as any).customer_email) {
    const emailHtml = `<div style="background:#0f0f1a;padding:32px;font-family:-apple-system,sans-serif"><div style="max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px;overflow:hidden"><div style="padding:24px;background:#1d1d35;border-bottom:1px solid #2a2a3a"><h1 style="margin:0;color:#ffffff;font-size:20px">${shop.name}</h1><p style="margin:4px 0 0;color:#8a8a9a;font-size:13px">Estimate ${(estimate as any).estimate_number}</p></div><div style="padding:24px"><p style="color:#e0e0e0;font-size:14px;margin:0 0 8px">Hi ${(estimate as any).customer_name || 'Customer'},</p><p style="color:#b0b0c0;font-size:13px;margin:0 0 16px">Here is your repair estimate${truckInfo ? ` for <strong style="color:#e0e0e0">${truckInfo}</strong>` : ''}.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#15152a"><th style="padding:8px 12px;text-align:left;color:#8a8a9a;font-size:11px;text-transform:uppercase">Description</th><th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase">Labor</th><th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase">Parts</th><th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase">Total</th></tr></thead><tbody>${linesHtml}</tbody></table><div style="text-align:right;padding:12px 0;border-top:1px solid #2a2a3a"><div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Subtotal: $${((estimate as any).subtotal || 0).toFixed(2)}</div><div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Tax: $${((estimate as any).tax_amount || 0).toFixed(2)}</div><div style="color:#ffffff;font-size:18px;font-weight:800">Total: $${((estimate as any).total || 0).toFixed(2)}</div></div><div style="text-align:center;margin:24px 0 8px"><a href="${portalLink}" style="display:inline-block;padding:14px 32px;background:#16A34A;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700">Review & Approve Estimate</a></div></div></div></div>`
    const sent = await sendEmail((estimate as any).customer_email, `Estimate ${(estimate as any).estimate_number} from ${shop.name}`, emailHtml)
    if (sent) sentVia.push('email')
  }
  if ((estimate as any).customer_phone) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromPhone = process.env.TWILIO_PHONE_NUMBER
      if (accountSid && authToken && fromPhone) {
        const twilio = (await import('twilio')).default
        const client = twilio(accountSid, authToken)
        const smsBody = `${shop.name} - Estimate ${(estimate as any).estimate_number}\n${truckInfo ? truckInfo + '\n' : ''}Total: $${((estimate as any).total || 0).toFixed(2)}\n\nReview & approve: ${portalLink}`
        await client.messages.create({ body: smsBody, from: fromPhone, to: (estimate as any).customer_phone })
        sentVia.push('sms')
      }
    } catch (err) {
      console.error('[Estimates] SMS send error:', err)
    }
  }
  if (sentVia.length > 0) await ctx.admin.from('estimates').update({ sent_via: sentVia.join(',') }).eq('id', id)
  return NextResponse.json({ success: true, sent_via: sentVia, portal_link: portalLink })
}

export const POST = safeRoute(_POST)
