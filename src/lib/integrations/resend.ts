// lib/integrations/resend.ts
import { Resend } from 'resend'


function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}
function getFrom() {
  return process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || 'TruckZen <noreply@truckzen.pro>'
}
function getReplyTo() {
  return process.env.RESEND_REPLY_TO || 'service@truckzen.pro'
}

export async function sendInvoiceEmail(data: any) {
  const shopName = data.shop.dba || data.shop.name
  const isPaid   = data.invoice.balance_due <= 0
  const subject  = isPaid
    ? `Receipt — ${data.invoice.invoice_number} — ${shopName}`
    : `Invoice ${data.invoice.invoice_number} — $${data.invoice.total.toFixed(2)} — ${shopName}`

  const fmt = (n: number) => '$' + Number(n || 0).toFixed(2)
  const lines = data.lines || []
  const laborLines = lines.filter((l: any) => l.line_type === 'labor')
  const partLines = lines.filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled')
  const so = data.serviceOrder || {}

  const lineRow = (desc: string, qty: string, rate: string, total: string) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${desc}</td><td style="padding:6px 8px;text-align:center;border-bottom:1px solid #eee">${qty}</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee">${rate}</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;font-weight:700">${total}</td></tr>`

  let lineItemsHtml = ''
  if (laborLines.length > 0) {
    lineItemsHtml += `<tr><td colspan="4" style="padding:8px;font-size:11px;font-weight:700;color:#1D6FE8;text-transform:uppercase;letter-spacing:.05em;background:#f8f9fa">Labor</td></tr>`
    for (const l of laborLines) {
      const hrs = l.billed_hours || l.quantity || 0 // customer-facing: billed hours only
      lineItemsHtml += lineRow(l.real_name || l.description || 'Labor', String(hrs), fmt(l.unit_price || 0), fmt(l.total_price || hrs * (l.unit_price || 0)))
    }
  }
  if (partLines.length > 0) {
    lineItemsHtml += `<tr><td colspan="4" style="padding:8px;font-size:11px;font-weight:700;color:#16A34A;text-transform:uppercase;letter-spacing:.05em;background:#f8f9fa">Parts</td></tr>`
    for (const l of partLines) {
      lineItemsHtml += lineRow(l.real_name || l.description || 'Part', String(l.quantity || 1), fmt(l.parts_sell_price || l.unit_price || 0), fmt(l.total_price || (l.parts_sell_price || l.unit_price || 0) * (l.quantity || 1)))
    }
  }

  const html = `
<div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;background:#fff;color:#1a1a1a">
  <!-- Header -->
  <div style="background:#0B0D11;padding:24px 28px;color:#fff">
    <div style="font-size:20px;font-weight:800;margin-bottom:4px">${shopName}</div>
    <div style="font-size:12px;color:#7C8BA0">${data.shop.address || ''} | ${data.shop.phone || ''}</div>
  </div>

  <div style="padding:28px">
    <!-- Invoice header -->
    <div style="display:flex;justify-content:space-between;margin-bottom:24px">
      <div>
        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${isPaid ? 'Receipt' : 'Invoice'}</div>
        <div style="font-size:18px;font-weight:800">${data.invoice.invoice_number}</div>
        ${data.invoice.due_date ? `<div style="font-size:12px;color:#6B7280;margin-top:4px">Due: ${data.invoice.due_date}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Bill To</div>
        <div style="font-size:14px;font-weight:700">${data.customer.company_name || ''}</div>
        <div style="font-size:12px;color:#6B7280">${data.customer.contact_name || ''}</div>
      </div>
    </div>

    <!-- Vehicle / WO info -->
    <div style="background:#f8f9fa;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:#374151">
      ${so.so_number ? `<strong>WO #${so.so_number}</strong>` : ''}
      ${so.truck_unit ? ` | Unit #${so.truck_unit}` : ''}
      ${so.truck_make_model ? ` | ${so.truck_make_model}` : ''}
      ${so.odometer_in ? ` | ${Number(so.odometer_in).toLocaleString()} mi` : ''}
      ${so.complaint ? `<div style="margin-top:4px;color:#6B7280">Complaint: ${so.complaint}</div>` : ''}
    </div>

    <!-- Line items -->
    ${lineItemsHtml ? `
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
      <thead><tr style="border-bottom:2px solid #1D6FE8">
        <th style="text-align:left;padding:6px 8px;font-size:10px;color:#6B7280;text-transform:uppercase">Description</th>
        <th style="text-align:center;padding:6px 8px;font-size:10px;color:#6B7280;text-transform:uppercase">Qty</th>
        <th style="text-align:right;padding:6px 8px;font-size:10px;color:#6B7280;text-transform:uppercase">Rate</th>
        <th style="text-align:right;padding:6px 8px;font-size:10px;color:#6B7280;text-transform:uppercase">Amount</th>
      </tr></thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>
    ` : ''}

    <!-- Totals -->
    <div style="border-top:2px solid #E5E7EB;padding-top:12px;margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span>Subtotal</span><span>${fmt(data.invoice.subtotal)}</span></div>
      ${data.invoice.tax_amount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#6B7280"><span>Tax</span><span>${fmt(data.invoice.tax_amount)}</span></div>` : ''}
      ${(data.invoice.amount_paid || 0) > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#16A34A"><span>Paid</span><span>-${fmt(data.invoice.amount_paid)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;padding:8px 0;border-top:1px solid #E5E7EB;margin-top:4px">
        <span>${isPaid ? 'Total Paid' : 'Amount Due'}</span>
        <span style="color:${isPaid ? '#16A34A' : '#1D6FE8'}">${fmt(isPaid ? data.invoice.total : data.invoice.balance_due ?? data.invoice.total)}</span>
      </div>
    </div>

    ${!isPaid ? `
    <!-- Payment Instructions -->
    <div style="background:#f0f7ff;border:1px solid #BFDBFE;border-radius:8px;padding:16px 20px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:#1D6FE8;margin-bottom:10px">Payment Instructions</div>
      <div style="font-size:12px;color:#374151;line-height:1.8">
        <strong>Company:</strong> UGL Truck Center Inc<br>
        <strong>Bank:</strong> Chase Bank<br><br>
        <strong>ACH Payment:</strong><br>
        Account: 583509081<br>
        Routing: 071000013<br><br>
        <strong>Wire Transfer:</strong><br>
        Account: 583509081<br>
        Routing: 021000021<br><br>
        <strong>Zelle:</strong><br>
        accounting.truckcenter@yahoo.com<br>
        sanjarbek@ugltruckcenterinc.com<br><br>
        <strong>Mail Payment To:</strong><br>
        UGL Truck Center Inc<br>
        325 State Rte 31<br>
        Montgomery, IL 60538
      </div>
      <div style="margin-top:12px;font-size:11px;color:#6B7280">Please include invoice number <strong>${data.invoice.invoice_number}</strong> with your payment.</div>
    </div>
    ` : ''}

    ${data.paymentUrl ? `
    <div style="text-align:center;margin-bottom:20px">
      <a href="${data.paymentUrl}" style="display:inline-block;padding:12px 28px;background:#1D6FE8;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Pay Online</a>
    </div>
    ` : ''}

    ${data.invoice.notes ? `<div style="font-size:12px;color:#6B7280;margin-bottom:20px"><strong>Notes:</strong> ${data.invoice.notes}</div>` : ''}
  </div>

  <!-- Footer -->
  <div style="background:#f8f9fa;padding:16px 28px;font-size:11px;color:#9CA3AF;text-align:center;border-top:1px solid #E5E7EB">
    ${shopName} | ${data.shop.address || ''} | ${data.shop.phone || ''} | ${data.shop.email || ''}
  </div>
</div>`

  try {
    const result = await getResend().emails.send({
      from:     getFrom(),
      to:       data.customer.email,
      reply_to:  data.shop.email || getReplyTo(),
      subject,
      html,
    })
    return { success: true, id: result.data?.id }
  } catch (err: any) {
    console.error('Resend error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function sendWelcomeEmail(to: string, name: string, shopName: string, loginUrl: string) {
  try {
    await getResend().emails.send({
      from:    getFrom(),
      to,
      subject: `Welcome to TruckZen — ${shopName}`,
      html: `
        <div style="font-family:sans-serif;background:#060708;color:#DDE3EE;padding:40px;max-width:480px;margin:0 auto">
          <div style="font-size:22px;font-weight:700;margin-bottom:16px">Welcome, ${name}</div>
          <p style="color:#7C8BA0;line-height:1.7">You've been added to TruckZen for ${shopName}. Click below to set your password and log in.</p>
          <a href="${loginUrl}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:linear-gradient(135deg,#1D6FE8,#1248B0);color:#fff;text-decoration:none;border-radius:9px;font-weight:700">Set Password & Log In</a>
          <p style="color:#48536A;font-size:12px">If you didn't expect this email, you can ignore it.</p>
        </div>`,
    })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  try {
    await getResend().emails.send({
      from:    getFrom(),
      to,
      subject: 'Reset your TruckZen password',
      html: `
        <div style="font-family:sans-serif;background:#060708;color:#DDE3EE;padding:40px;max-width:480px;margin:0 auto">
          <div style="font-size:22px;font-weight:700;margin-bottom:16px">Reset Password</div>
          <p style="color:#7C8BA0;line-height:1.7">Hi ${name}, click below to reset your TruckZen password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:linear-gradient(135deg,#1D6FE8,#1248B0);color:#fff;text-decoration:none;border-radius:9px;font-weight:700">Reset Password</a>
          <p style="color:#48536A;font-size:12px">If you didn't request this, ignore it. Your password won't change.</p>
        </div>`,
    })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
