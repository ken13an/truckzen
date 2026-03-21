import { emailWrapper, infoCard } from './wrapper'

interface StaffPaymentReceivedData {
  customerName: string
  invoiceNumber: string
  amount: string
  method: string
  shop: { name: string; phone: string }
}

export function staffPaymentReceivedEmail(data: StaffPaymentReceivedData): { subject: string; html: string } {
  return {
    subject: `Payment received: $${data.amount} for ${data.invoiceNumber}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">Payment received from ${data.customerName}.</p>
      ${infoCard('Amount', '$' + data.amount)}
      <div style="background: #161B24; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 8px; color: #7C8BA0; font-size: 12px;">DETAILS</p>
        <p style="margin: 0 0 4px; color: #DDE3EE;"><strong>Invoice:</strong> ${data.invoiceNumber}</p>
        <p style="margin: 0 0 4px; color: #DDE3EE;"><strong>Customer:</strong> ${data.customerName}</p>
        <p style="margin: 0; color: #DDE3EE;"><strong>Method:</strong> ${data.method}</p>
      </div>
    `),
  }
}
