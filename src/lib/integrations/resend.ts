// lib/integrations/resend.ts
import { Resend } from 'resend'
import { renderInvoiceEmail, type InvoiceEmailData } from '@/emails/invoice'

const resend   = new Resend(process.env.RESEND_API_KEY!)
const FROM     = process.env.RESEND_FROM_EMAIL || 'invoices@truckzen.com'
const REPLY_TO = process.env.RESEND_REPLY_TO   || 'service@truckzen.com'

export async function sendInvoiceEmail(data: InvoiceEmailData) {
  const shopName = data.shop.dba || data.shop.name
  const isPaid   = data.invoice.balance_due <= 0
  const subject  = isPaid
    ? `Receipt — ${data.invoice.invoice_number} — ${shopName}`
    : `Invoice ${data.invoice.invoice_number} — $${data.invoice.total.toFixed(2)} — ${shopName}`

  const html = renderInvoiceEmail(data)

  try {
    const result = await resend.emails.send({
      from:     `${shopName} <${FROM}>`,
      to:       data.customer.email,
      replyTo:  data.shop.email || REPLY_TO,
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
    await resend.emails.send({
      from:    `${shopName} <${FROM}>`,
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
    await resend.emails.send({
      from:    `TruckZen <${FROM}>`,
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
