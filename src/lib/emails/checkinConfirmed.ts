import { emailWrapper, blueButton, infoCard } from './wrapper'

interface CheckinConfirmedData {
  customerName: string
  unitNumber: string
  reference: string
  portalLink: string
  shop: { name: string; phone: string }
}

export function checkinConfirmedEmail(data: CheckinConfirmedData): { subject: string; html: string } {
  return {
    subject: `Check-in confirmed for Unit #${data.unitNumber} - ${data.shop.name}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">Hi ${data.customerName},</p>
      <p style="color: #DDE3EE;">We received your truck and it's in our system. Your reference number is:</p>
      ${infoCard('Reference', data.reference)}
      <p style="color: #DDE3EE;">We'll contact you with an estimate soon. You can track your repair status anytime:</p>
      ${blueButton('Track Your Repair', data.portalLink)}
    `),
  }
}
