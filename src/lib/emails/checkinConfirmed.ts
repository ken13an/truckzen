import { emailWrapper } from './wrapper'

interface CheckinConfirmedData {
  customerName: string
  unitNumber: string
  reference: string
  portalLink: string
  shop: { name: string; phone: string }
  estimateExpected: boolean
  concern: string
}

export function checkinConfirmedEmail(data: CheckinConfirmedData): { subject: string; html: string } {
  const updateLine = data.estimateExpected
    ? "We'll send you an estimate as soon as it's ready."
    : "We'll contact you with an update soon."

  return {
    subject: `Check-in confirmed for Unit #${data.unitNumber} - ${data.shop.name}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE; margin: 0 0 12px;">Hi ${data.customerName},</p>
      <p style="color: #DDE3EE; margin: 0 0 16px;">We received your check-in for Unit #${data.unitNumber} and your request is now under shop review.</p>
      <div style="border-left: 3px solid #1B6EE6; padding: 10px 14px; margin: 0 0 16px; background: rgba(27,110,230,0.08); color: #DDE3EE; font-size: 14px; line-height: 1.6;">
        <div><strong>Reference:</strong> ${data.reference}</div>
        <div><strong>Unit:</strong> #${data.unitNumber}</div>
        <div><strong>Your request:</strong> "${data.concern}"</div>
      </div>
      <p style="color: #DDE3EE; margin: 0 0 16px;">${updateLine}</p>
      <p style="margin: 0;">
        <a href="${data.portalLink}" style="display: inline-block; padding: 12px 28px; background: #1B6EE6; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">View Status</a>
      </p>
    `),
  }
}
