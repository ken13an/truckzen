import { emailWrapper, blueButton } from './wrapper'

interface RepairTrackingLinkData {
  customerName: string
  woNumber: string
  trackingLink: string
  shop: { name: string; phone: string; logoUrl?: string | null }
}

export function repairTrackingLinkEmail(data: RepairTrackingLinkData): { subject: string; html: string } {
  return {
    subject: `Your repair is approved — track progress for ${data.woNumber}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">Hi ${data.customerName},</p>
      <p style="color: #DDE3EE;">Thanks for approving the estimate. Repair work is moving forward on ${data.woNumber}.</p>
      <p style="color: #DDE3EE;">You can follow progress any time using the link below:</p>
      ${blueButton('Track repair progress', data.trackingLink)}
      <p style="color: #7C8BA0; font-size: 13px;">We'll keep this page up to date as work proceeds.</p>
    `),
  }
}
