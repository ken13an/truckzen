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
    subject: `Invoice ${data.invoiceNumber} — $${data.amount} — ${data.shop.name}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">Hi ${data.customerName},</p>
      <p style="color: #DDE3EE;">Your truck Unit #${data.unitNumber} service is complete. Please find your invoice attached.</p>
      ${infoCard('Invoice ' + data.invoiceNumber, '$' + data.amount)}
      <p style="color: #7C8BA0; font-size: 13px;">Payment instructions are included in the attached invoice. Please include invoice number <strong>${data.invoiceNumber}</strong> with your payment.</p>
      <p style="color: #7C8BA0; font-size: 13px;">Questions? Call us at ${data.shop.phone}</p>
    `),
  }
}
