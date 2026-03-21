import { emailWrapper, infoCard } from './wrapper'

interface StaffCheckinAlertData {
  unitNumber: string
  company: string
  concern: string
  customerName: string
  shop: { name: string; phone: string }
}

export function staffCheckinAlertEmail(data: StaffCheckinAlertData): { subject: string; html: string } {
  return {
    subject: `New kiosk check-in: Unit ${data.unitNumber} - ${data.company}`,
    html: emailWrapper(data.shop, `
      <p style="color: #DDE3EE;">A new truck has been checked in via the kiosk.</p>
      ${infoCard('Unit', data.unitNumber)}
      <div style="background: #161B24; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 8px; color: #7C8BA0; font-size: 12px;">DETAILS</p>
        <p style="margin: 0 0 4px; color: #DDE3EE;"><strong>Customer:</strong> ${data.customerName}</p>
        <p style="margin: 0 0 4px; color: #DDE3EE;"><strong>Company:</strong> ${data.company}</p>
        <p style="margin: 0; color: #DDE3EE;"><strong>Concern:</strong> ${data.concern}</p>
      </div>
    `),
  }
}
