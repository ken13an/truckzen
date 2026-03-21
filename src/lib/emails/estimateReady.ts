import { emailWrapper, blueButton, infoCard } from './wrapper'

interface EstimateReadyData {
  customerName: string
  unitNumber: string
  amount: string
  portalLink: string
  shop: { name: string; phone: string }
}

export function estimateReadyEmail(data: EstimateReadyData): { subject: string; html: string } {
  return {
    subject: `Estimate ready for Unit #${data.unitNumber} - ${data.shop.name}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">Hi ${data.customerName},</p>
      <p style="color: #DDE3EE;">Your estimate for Unit #${data.unitNumber} is ready.</p>
      ${infoCard('Estimate Total', '$' + data.amount)}
      <p style="color: #DDE3EE;">Review the details and approve or decline directly from your portal:</p>
      ${blueButton('View Estimate', data.portalLink)}
    `),
  }
}
