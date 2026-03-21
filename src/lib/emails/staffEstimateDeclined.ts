import { emailWrapper, infoCard } from './wrapper'

interface StaffEstimateDeclinedData {
  customerName: string
  woNumber: string
  reason: string
  shop: { name: string; phone: string }
}

export function staffEstimateDeclinedEmail(data: StaffEstimateDeclinedData): { subject: string; html: string } {
  return {
    subject: `Estimate declined: ${data.woNumber} by ${data.customerName}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">${data.customerName} declined the estimate for work order ${data.woNumber}.</p>
      <div style="background: #161B24; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 8px; color: #7C8BA0; font-size: 12px; text-transform: uppercase;">Reason</p>
        <p style="margin: 0; color: #F0F4FF; font-size: 15px;">${data.reason}</p>
      </div>
      <p style="color: #DDE3EE;">Please follow up with the customer.</p>
    `),
  }
}
