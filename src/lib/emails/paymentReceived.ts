import { emailWrapper, infoCard } from './wrapper'

interface PaymentReceivedData {
  customerName: string
  invoiceNumber: string
  amount: string
  shop: { name: string; phone: string }
}

export function paymentReceivedEmail(data: PaymentReceivedData): { subject: string; html: string } {
  return {
    subject: `Payment received for Invoice ${data.invoiceNumber} - ${data.shop.name}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">Hi ${data.customerName},</p>
      <p style="color: #DDE3EE;">We received your payment. Thank you!</p>
      ${infoCard('Payment Received', '$' + data.amount)}
      <p style="color: #7C8BA0; font-size: 13px;">Invoice: ${data.invoiceNumber}</p>
    `),
  }
}
