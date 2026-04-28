import { NextResponse } from 'next/server'
import { sendEmail, getShopInfo } from '@/lib/services/email'
import { requireRouteContext } from '@/lib/api-route-auth'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'
import { rateLimit } from '@/lib/ratelimit/core'
import { generateEstimatePdf } from '@/lib/pdf/generateEstimatePdf'
import { ensureEstimateSnapshot, validateEstimateSnapshot } from '@/lib/estimates/snapshotEnsure'
import { assertPartsRequirementResolved } from '@/lib/parts-status'
import { validateJobLines } from '@/lib/work-orders/jobLineValidation'

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

// Recipient overrides (Phase 2A). Caller may pass:
//   - { to_email: string }      legacy single-recipient (free-form, regex only)
//   - { to_emails: string[] }   new multi-recipient. Element [0] is the
//                               primary and keeps legacy free-form behavior;
//                               elements [1..] must each match customers.email
//                               or customer_contacts.email for the estimate's
//                               customer_id. The route auth/shop-scoped
//                               estimate lookup still gates access. Overrides
//                               do NOT mutate customers/estimates rows.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function maskEmail(s: string): string {
  if (!s || !s.includes('@')) return s || ''
  const [local, domain] = s.split('@')
  return `${local.slice(0, 2)}***@${domain}`
}

async function _POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireRouteContext([...INVOICE_ACTION_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const sendLimit = await rateLimit('estimate-send-user', ctx.actor.id)
  if (!sendLimit.allowed) return NextResponse.json({ error: 'Too many estimate requests' }, { status: 429 })
  const { data: estimate, error } = await getEstimateForActor(ctx.admin, ctx.actor, id)
  if (error || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  // Optional recipient overrides from request body. If invalid, ignore the
  // override and fall back to the stored estimate.customer_email; do NOT 422
  // — the stored value may still be valid.
  let bodyJson: any = null
  try { bodyJson = await req.json() } catch { bodyJson = null }
  const rawToEmails: string[] = Array.isArray(bodyJson?.to_emails)
    ? bodyJson.to_emails.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean)
    : []
  const rawToEmail = typeof bodyJson?.to_email === 'string' ? bodyJson.to_email.trim() : ''
  const rawToPhone = typeof bodyJson?.to_phone === 'string' ? bodyJson.to_phone.trim() : ''

  // Resolve the final email recipient list (multi-recipient path or legacy
  // single-recipient path). Returns display strings; dedupe is by lowercase.
  // The first element is treated as the "primary" and keeps legacy free-form
  // override semantics. Elements [1..] must match customers.email or
  // customer_contacts.email for the estimate's customer_id.
  const recipientEmails: string[] = []
  if (rawToEmails.length > 0) {
    const formatValid = rawToEmails.filter(e => EMAIL_RE.test(e))
    if (formatValid.length < rawToEmails.length) {
      console.warn('[estimate-send] some to_emails entries rejected as invalid format', {
        estimateId: id,
        provided: rawToEmails.length,
        valid: formatValid.length,
      })
    }
    if (formatValid.length > 0) {
      const customerId = (estimate as any).customer_id || null
      const allowedEmailsLc = new Set<string>()
      const estCustEmail = (estimate as any).customer_email
      if (estCustEmail) allowedEmailsLc.add(String(estCustEmail).toLowerCase())
      if (customerId) {
        const { data: cust } = await ctx.admin.from('customers').select('email').eq('id', customerId).maybeSingle()
        if (cust?.email) allowedEmailsLc.add(String(cust.email).toLowerCase())
        const { data: contacts } = await ctx.admin.from('customer_contacts').select('email').eq('customer_id', customerId)
        for (const c of contacts || []) {
          if (c?.email) allowedEmailsLc.add(String(c.email).toLowerCase())
        }
      }
      const seen = new Set<string>()
      for (let i = 0; i < formatValid.length; i++) {
        const email = formatValid[i]
        const lower = email.toLowerCase()
        if (seen.has(lower)) continue
        if (i === 0) {
          // Primary: free-form allowed (legacy override behavior)
          seen.add(lower)
          recipientEmails.push(email)
        } else if (allowedEmailsLc.has(lower)) {
          seen.add(lower)
          recipientEmails.push(email)
        } else {
          console.warn('[estimate-send] extra recipient rejected — not in customer scope', {
            estimateId: id,
            customerId,
            masked: maskEmail(email),
          })
        }
      }
    }
  } else if (rawToEmail) {
    if (EMAIL_RE.test(rawToEmail)) {
      recipientEmails.push(rawToEmail)
    } else {
      console.warn('[estimate-send] override email rejected as invalid format', { estimateId: id, masked: maskEmail(rawToEmail) })
    }
  }

  // Final fallback to stored estimate.customer_email if nothing valid above.
  if (recipientEmails.length === 0 && (estimate as any).customer_email) {
    recipientEmails.push((estimate as any).customer_email)
  }

  const recipientEmail = recipientEmails[0] || ''
  const recipientPhone = rawToPhone || (estimate as any).customer_phone || ''
  console.info('[estimate-send] recipients resolved', {
    estimateId: id,
    emailCount: recipientEmails.length,
    primaryMasked: maskEmail(recipientEmail),
    extraCount: Math.max(0, recipientEmails.length - 1),
    phoneSource: rawToPhone ? 'override' : ((estimate as any).customer_phone ? 'estimate.customer_phone' : 'none'),
  })

  // RULE 7 step 1 — snapshot ensure (idempotent, no overwrite of existing rows).
  const ensure = await ensureEstimateSnapshot(ctx.admin, id)
  if (!ensure.ok) {
    console.warn('[estimate-send] snapshot ensure failed', { estimateId: id, reason: ensure.reason, created: ensure.created, existed: ensure.existed })
    return NextResponse.json({ error: `Cannot send: snapshot ensure failed (${ensure.reason})` }, { status: 422 })
  }
  console.info('[estimate-send] snapshot ensure ok', { estimateId: id, created: ensure.created, existed: ensure.existed })

  // RULE 7 step 2 — snapshot validate (read-only). Structural-only — does
  // not reject on $0 totals (those are normal placeholder states).
  const validation = await validateEstimateSnapshot(ctx.admin, id)
  if (!validation.ok) {
    console.warn('[estimate-send] snapshot validation failed', { estimateId: id, reason: validation.reason, laborCount: validation.laborCount, partCount: validation.partCount })
    return NextResponse.json({ error: `Cannot send: snapshot incomplete (${validation.reason})` }, { status: 422 })
  }
  console.info('[estimate-send] snapshot validation ok', { estimateId: id, laborCount: validation.laborCount, partCount: validation.partCount, grandTotal: validation.grandTotal })

  // Parts-readiness gate — every non-canceled labor line on this WO must
  // have a resolved parts_requirement (needed + priced child, customer_supplied
  // with note, not_needed, override with role+note, or canonical labor-only).
  // Mirrors the canonical predicate in src/lib/parts-status.ts so original and
  // later-added job lines are validated by the same rule before customer send.
  const repairOrderIdForGate = (estimate as any).repair_order_id || (estimate as any).wo_id
  if (repairOrderIdForGate) {
    const actorRole = ctx.actor.impersonate_role || ctx.actor.role
    const partsGate = await assertPartsRequirementResolved(ctx.admin, repairOrderIdForGate, actorRole)
    if (!partsGate.ok) {
      console.warn('[estimate-send] parts gate blocked', { estimateId: id, woId: repairOrderIdForGate, failures: partsGate.failures })
      return NextResponse.json({
        error: 'Resolve parts decisions before sending this estimate.',
        unresolved_lines: partsGate.failures,
      }, { status: 422 })
    }

    // Phase 2B: deterministic job-line validation. Currently catches generic
    // tire descriptions that lack position metadata. Mirrors the parts-gate
    // 422 shape so the modal can surface unresolved_lines uniformly.
    const { data: jobLinesForGate } = await ctx.admin
      .from('so_lines')
      .select('id, description, line_type, line_status, status, parts_status, tire_position')
      .eq('so_id', repairOrderIdForGate)
      .eq('line_type', 'labor')
    const lineFailures = validateJobLines(jobLinesForGate || [])
    if (lineFailures.length > 0) {
      console.warn('[estimate-send] job-line gate blocked', { estimateId: id, woId: repairOrderIdForGate, failures: lineFailures.map(f => f.code) })
      return NextResponse.json({
        error: 'invalid_job_lines',
        message: 'Fix highlighted job lines before sending estimate.',
        unresolved_lines: lineFailures,
      }, { status: 422 })
    }
  }

  // RULE 7 step 3 — generate PDF (must succeed before email goes out).
  const pdfResult = await generateEstimatePdf(id)
  if (!pdfResult) {
    console.warn('[estimate-send] PDF generation failed — refusing to send email', { estimateId: id, laborCount: validation.laborCount, partCount: validation.partCount })
    return NextResponse.json({ error: 'Cannot send: PDF generation failed' }, { status: 500 })
  }
  const attachments = [{ filename: pdfResult.filename, content: Buffer.from(pdfResult.pdfBytes) }]
  console.info('[estimate-send] pdf generated', { estimateId: id, filename: pdfResult.filename, bytes: pdfResult.pdfBytes.length })

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
  // Approval-state truth from the post-ensure row (estimate.status reflects
  // the same value the PDF reads). When already approved we omit the CTA
  // block entirely — sending another "Review & Approve" link to a customer
  // who already approved is misleading.
  const isApproved = String((estPostEnsure as any)?.status || (estimate as any).status || '').toLowerCase() === 'approved'

  const sentVia: string[] = []
  const sentEmails: string[] = []
  const failedEmails: Array<{ email: string; error: string }> = []
  if (recipientEmails.length > 0) {
    const ctaHtml = isApproved
      ? ''
      : `<div style="text-align:center;margin:24px 0 8px"><a href="${portalLink}" style="display:inline-block;padding:14px 32px;background:#16A34A;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700">Review & Approve Estimate</a></div>`
    const emailHtml = `<div style="background:#0f0f1a;padding:32px;font-family:-apple-system,sans-serif"><div style="max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px;overflow:hidden"><div style="padding:24px;background:#1d1d35;border-bottom:1px solid #2a2a3a"><h1 style="margin:0;color:#ffffff;font-size:20px">${shop.name}</h1><p style="margin:4px 0 0;color:#8a8a9a;font-size:13px">Estimate ${(estimate as any).estimate_number}</p></div><div style="padding:24px"><p style="color:#e0e0e0;font-size:14px;margin:0 0 8px">Hi ${(estimate as any).customer_name || 'Customer'},</p><p style="color:#b0b0c0;font-size:13px;margin:0 0 16px">Here is your repair estimate${truckInfo ? ` for <strong style="color:#e0e0e0">${truckInfo}</strong>` : ''}. The full breakdown is attached as a PDF.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#15152a"><th style="padding:8px 12px;text-align:left;color:#8a8a9a;font-size:11px;text-transform:uppercase">Description</th><th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase">Labor</th><th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase">Parts</th><th style="padding:8px 12px;text-align:right;color:#8a8a9a;font-size:11px;text-transform:uppercase">Total</th></tr></thead><tbody>${linesHtml}</tbody></table><div style="text-align:right;padding:12px 0;border-top:1px solid #2a2a3a"><div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Subtotal: $${subtotal.toFixed(2)}</div><div style="color:#8a8a9a;font-size:12px;margin-bottom:4px">Tax: $${tax.toFixed(2)}</div><div style="color:#ffffff;font-size:18px;font-weight:800">Total: $${total.toFixed(2)}</div></div>${ctaHtml}</div></div></div>`
    const subjectLine = `Estimate ${(estimate as any).estimate_number} from ${shop.name}`
    // One Resend call per recipient so we get per-recipient success tracking
    // and a per-recipient notification_log row.
    for (const recipient of recipientEmails) {
      const ok = await sendEmail(recipient, subjectLine, emailHtml, attachments)
      const logMessage = `estimate=${id} estimate_number=${(estimate as any).estimate_number ?? ''} recipient=${recipient} ok=${ok}`
      const { error: logErr } = await ctx.admin.from('notification_log').insert({
        shop_id: (estimate as any).shop_id,
        event: 'estimate.email.sent',
        recipients: [],
        channels: ['email'],
        message: logMessage,
      })
      if (logErr) console.error('[notification_log] insert failed', { event: 'estimate.email.sent', error: logErr.message })
      if (ok) sentEmails.push(recipient)
      else failedEmails.push({ email: recipient, error: 'send_failed' })
    }
    if (sentEmails.length > 0) sentVia.push('email')
  }
  if (recipientPhone) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromPhone = process.env.TWILIO_PHONE_NUMBER
      if (accountSid && authToken && fromPhone) {
        const twilio = (await import('twilio')).default
        const client = twilio(accountSid, authToken)
        const smsBody = `${shop.name} - Estimate ${(estimate as any).estimate_number}\n${truckInfo ? truckInfo + '\n' : ''}Total: $${total.toFixed(2)}\n\nReview & approve: ${portalLink}`
        await client.messages.create({ body: smsBody, from: fromPhone, to: recipientPhone })
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

  return NextResponse.json({
    success: true,
    sent_via: sentVia,
    portal_link: portalLink,
    snapshot_lines: validation.laborCount + validation.partCount,
    recipients: sentEmails,
    sent_count: sentEmails.length,
    failed_count: failedEmails.length,
    ...(failedEmails.length > 0 ? { failures: failedEmails } : {}),
  })
}

export const POST = safeRoute(_POST)
