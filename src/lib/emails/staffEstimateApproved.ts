import { emailWrapper, infoCard } from './wrapper'

interface StaffEstimateApprovedData {
  customerName: string
  woNumber: string
  amount: string
  shop: { name: string; phone: string }
}

export function staffEstimateApprovedEmail(data: StaffEstimateApprovedData): { subject: string; html: string } {
  return {
    subject: `Estimate approved: ${data.woNumber} by ${data.customerName}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">${data.customerName} approved the estimate for work order ${data.woNumber}.</p>
      ${infoCard('Approved Total', '$' + data.amount)}
      <p style="color: #DDE3EE;">Work can now be scheduled.</p>
    `),
  }
}
