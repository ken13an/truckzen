import { emailWrapper, blueButton, infoCard } from './wrapper'

interface TruckReadyData {
  customerName: string
  unitNumber: string
  invoiceNumber: string
  amount: string
  payLink: string
  shop: { name: string; phone: string }
}

export function truckReadyEmail(data: TruckReadyData): { subject: string; html: string } {
  return {
    subject: `Unit #${data.unitNumber} is ready for pickup - ${data.shop.name}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">Hi ${data.customerName},</p>
      <p style="color: #DDE3EE;">Your truck Unit #${data.unitNumber} is ready for pickup!</p>
      ${infoCard('Invoice ' + data.invoiceNumber, '$' + data.amount)}
      <p style="color: #DDE3EE;">You can pay online to speed up the pickup process:</p>
      ${blueButton('Pay Online', data.payLink)}
    `),
  }
}
