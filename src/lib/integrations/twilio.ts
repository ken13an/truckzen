// lib/integrations/twilio.ts
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)
const FROM = process.env.TWILIO_PHONE_NUMBER!

export async function sendSMS(to: string, body: string): Promise<boolean> {
  if (!to || !body) return false
  // Normalize phone number
  const normalized = to.replace(/\D/g, '')
  const e164 = normalized.startsWith('1') ? `+${normalized}` : `+1${normalized}`
  try {
    await client.messages.create({ from: FROM, to: e164, body: body.slice(0, 1600) })
    return true
  } catch (err: any) {
    console.error('Twilio SMS error:', err.message)
    return false
  }
}

// Pre-built message templates
export const SMS = {
  kioskCheckin: (ref: string, advisorName: string) =>
    `TruckZen: New kiosk check-in — Ref ${ref}. Please greet the customer. — ${advisorName}`,

  partsReady: (techName: string, soNumber: string, truckUnit: string, binLocation?: string) =>
    `TruckZen: Hey ${techName}, parts are ready for ${soNumber} (Truck #${truckUnit}).${binLocation ? ` Bin: ${binLocation}.` : ''} Come pick them up.`,

  jobDone: (customerName: string, truckUnit: string, shopName: string, paymentUrl?: string) =>
    `${shopName}: Your truck #${truckUnit} is ready for pickup.${paymentUrl ? ` Pay here: ${paymentUrl}` : ''} Call us with any questions.`,

  invoiceReminder: (customerName: string, invoiceNum: string, amount: number, paymentUrl: string) =>
    `TruckZen: Invoice ${invoiceNum} ($${amount.toFixed(0)}) is overdue. Pay here: ${paymentUrl}`,

  pmDue: (truckUnit: string, serviceName: string, shopPhone: string) =>
    `TruckZen: Unit #${truckUnit} is due for ${serviceName}. Call ${shopPhone} to schedule.`,

  cleaningAssignment: (techName: string, zone: string, shopName: string) =>
    `${shopName}: ${techName}, no jobs right now — please clean ${zone}. Checklist in the TruckZen app.`,
}
