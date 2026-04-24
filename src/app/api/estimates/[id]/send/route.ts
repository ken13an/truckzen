import { NextResponse } from 'next/server'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { requireRouteContext } from '@/lib/api-route-auth'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'
import { rateLimit } from '@/lib/ratelimit/core'
import { generateEstimatePdf } from '@/lib/pdf/generateEstimatePdf'
import { ensureEstimateSnapshot, validateEstimateSnapshot } from '@/lib/estimates/snapshotEnsure'

// CUSTOMER-SEND GATE
//
// Order of operations (RULE 7 — NO PARTIAL SEND):
//   1. ensureEstimateSnapshot — idempotently create estimate_lines from
//      live so_lines if they don't exist yet. Same formula as
//      /api/estimates POST create_from_wo. After this point, no live
//      so_lines may flow into customer-facing surfaces.
//   2. validateEstimateSnapshot — read-only check that snapshot is
//      complete enough for a customer-facing PDF.
//   3. generateEstimatePdf — must succeed; bytes are attached AND used
//      to gate the email.
//   4. sendEmail with the PDF attached.
//   5. Update estimates.status to 'sent' on success.
//
// Email body and PDF both read the validated snapshot (estimates row +
// estimate_lines via the generator) — RULE 11.

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

  // RULE 7 step 1 — snapshot ensure (idempotent, no overwrite of existing rows).
  const ensure = await ensureEstimateSnapshot(ctx.admin, id)
  if (!ensure.ok) {
    console.warn('[estimate-send] snapshot ensure failed', { estimateId: id, reason: ensure.reason })
    return NextResponse.json({ error: `Cannot send: snapshot ensure failed (${ensure.reason})` }, { status: 422 })
  }

  // RULE 7 step 2 — snapshot validate (read-only).
  const validation = await validateEstimateSnapshot(ctx.admin, id)
  if (!validation.ok) {
    console.warn('[estimate-send] snapshot validation failed', { estimateId: id, reason: validation.reason })
    return NextResponse.json({ error: `Cannot send: snapshot incomplete (${validation.reason})` }, { status: 422 })
  }

  // RULE 7 step 3 — generate PDF (must succeed before email goes out).
  const pdfResult = await generateEstimatePdf(id)
  if (!pdfResult) {
    console.warn('[estimate-send] PDF generation failed — refusing to send email', { estimateId: id })
    return NextResponse.json({ error: 'Cannot send: PDF generation failed' }, { status: 500 })
  }
  const attachments = [{ filename: pdfResult.filename, content: Buffer.from(pdfResult.pdfBytes) }]

  const repairOrderId = (estimate as any).repair_order_id || (estimate as any).wo_id
  const shop = await getShopInfo((estimate as any).shop_id)
  const portalLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/estimate/${(estimate as any).approval_token}`
  let truckInfo = ''
  if (repairOrderId) {
    const { data: so } = await ctx.admin.from('service_orders').select('so_number, assets(unit_number, year, make, model)').eq('id', repairOrderId).single()
    if (so) { const asset = so.assets as any; truckInfo = asset ? `Unit #${asset.unit_number} - ${asset.year} ${asset.make} ${asset.model}` : '' }
  }

  // Email body reads the SAME snapshot the PDF reads — re-fetch the
  // post-ensure estimate row + estimate_lines to guarantee payload match.
  const { data: estPostEnsure } = await ctx.admin.from('estimates').select('*').eq('id', id).single()
  const { data: snapLines } = await ctx.admin.from('estimate_lines').select('*').eq('estimate_id', id).order('line_number', { ascending: true, nullsFirst: false })
  const linesHtml = (snapLines || []).map((l: any) => {
    const labor = Number(l.labor_total) || ((l.line_type === 'labor') ? (Number(l.line_total) || Number(l.total) || 0) : 0)
    const parts = Number(l.parts_total) || ((l.line_type === 'part') ? (Number(l.line_total) || Number(l.total) || 0) : 0)
    const lineTotal = Number(l.line_total) || Number(l.total) || (labor + parts)
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px">${l.description || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right">$${labor.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#b0b0c0;font-size:13px;text-align:right">$${parts.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#e0e0e0;font-size:13px;font-weight:700;text-align:right">$${lineTotal.toFixed(2)}</td>
    </tr>`
  }).join('')

  const subtotal = Number((estPostEnsure as any)?.subtotal) || 0
  const tax = Number((estPostEnsure as any)?.tax_amount) || 0
  const total = Number((estPostEnsure as any)?.grand_total) || Number((estPostEnsure as any)?.total) || 0

  const sentVia: string[] = []
  if ((estimate as any).customer_email) {
    const emailHtml = `<div style="background:#0f0f1a;padding:32px;font-family:-apple-system,sans-serif"><div style="max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px;overflow:hidden"><div style="padding:24px;background:#1d1d35;border-bottom:1px solid #2a2a3a"><h1 style="margin:0;color:#ffffff;font-size:20px">${shop.name}</h1><p style="margin:4px 0 0;color:#8a8a9a;font-size:13px">Estimate ${(estimate as any).estimate_number}</p></div><div style="padding:24px"><p style="color:#e0e0e0;font-size:14px;margin:0 0 8px">Hi ${(estimate as any).customer_name || 'Customer'},</p><p style="color:#b0b0c0;font-size:13px;margin:0 0 16px">Here is your repair estimate${truckInfo ? ` for <strong style="color:#e0e0e0">${truckInfo}</strong>` : ''}. The full breakdown is attached as a PDF.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#15152a"><th style="padding:8px 12px;text-align:left;color:#8a8a9a;font-size:11px;text-transform:uppercase">Description</th><th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase">Labor</th><th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase">Parts</th><th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase">Total</th></tr></thead><tbody>${linesHtml}</tbody></table><div style="text-align:right;padding:12px 0;border-top:1px solid #2a2a3a"><div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Subtotal: $${subtotal.toFixed(2)}</div><div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Tax: $${tax.toFixed(2)}</div><div style="color:#ffffff;font-size:18px;font-weight:800">Total: $${total.toFixed(2)}</div></div><div style="text-align:center;margin:24px 0 8px"><a href="${portalLink}" style="display:inline-block;padding:14px 32px;background:#16A34A;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700">Review & Approve Estimate</a></div></div></div></div>`
    const sent = await sendEmail((estimate as any).customer_email, `Estimate ${(estimate as any).estimate_number} from ${shop.name}`, emailHtml, attachments)
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
        const smsBody = `${shop.name} - Estimate ${(estimate as any).estimate_number}\n${truckInfo ? truckInfo + '\n' : ''}Total: $${total.toFixed(2)}\n\nReview & approve: ${portalLink}`
        await client.messages.create({ body: smsBody, from: fromPhone, to: (estimate as any).customer_phone })
        sentVia.push('sms')
      }
    } catch (err) {
      console.error('[Estimates] SMS send error:', err)
    }
  }

  // Only mark sent / move WO state AFTER the send actually succeeded.
  // RULE 7 — no partial send: an email-without-PDF error path returned
  // above; an SMS-only success here is acceptable since email failure is
  // already a status 502 path... actually we don't error on email-only-fail
  // currently; keep behavior consistent with prior version (mark as sent
  // when ANY channel was used).
  if (sentVia.length === 0) {
    return NextResponse.json({ error: 'Estimate not sent — no delivery channel succeeded' }, { status: 502 })
  }
  const now = new Date().toISOString()
  const validUntil = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  await ctx.admin.from('estimates').update({ status: 'sent', sent_at: now, valid_until: validUntil, updated_at: now, sent_via: sentVia.join(',') }).eq('id', id)
  if (repairOrderId) await ctx.admin.from('service_orders').update({ estimate_status: 'sent', updated_at: now }).eq('id', repairOrderId)

  return NextResponse.json({ success: true, sent_via: sentVia, portal_link: portalLink, snapshot_lines: validation.laborCount + validation.partCount })
}

export const POST = safeRoute(_POST)
