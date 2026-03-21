import { emailWrapper, blueButton } from './wrapper'

interface WorkStartedData {
  customerName: string
  unitNumber: string
  year: string
  make: string
  model: string
  portalLink: string
  shop: { name: string; phone: string }
}

export function workStartedEmail(data: WorkStartedData): { subject: string; html: string } {
  return {
    subject: `Work started on Unit #${data.unitNumber} - ${data.shop.name}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">Hi ${data.customerName},</p>
      <p style="color: #DDE3EE;">Work has started on your ${data.year} ${data.make} ${data.model} (Unit #${data.unitNumber}). Our technicians are on it.</p>
      <p style="color: #DDE3EE;">You can track progress anytime:</p>
      ${blueButton('Track Progress', data.portalLink)}
    `),
  }
}
