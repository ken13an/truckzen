import { readFileSync } from 'fs'
const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)/); if (m) process.env[m[1]] = m[2]; }

import { generateInvoicePdf } from '../src/lib/pdf/generateInvoicePdf'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const INV_ID = '233e61c6-4c58-4f6f-bf31-24a2305378e2'
  const result = await generateInvoicePdf(INV_ID)
  if (!result) { console.log('PDF generation failed'); return }
  console.log('PDF:', result.pdfBytes.length, 'bytes,', result.filename)

  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: inv } = await s.from('invoices').select('invoice_number, total, customer_id, shop_id').eq('id', INV_ID).single()
  const { data: cust } = await s.from('customers').select('email, company_name, contact_name').eq('id', inv!.customer_id).single()
  const { data: shop } = await s.from('shops').select('name, dba, phone, email, address').eq('id', inv!.shop_id).single()
  const shopName = shop!.dba || shop!.name

  const resend = new Resend(process.env.RESEND_API_KEY)
  const r = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'TruckZen <no-reply@truckzen.pro>',
    to: cust!.email!,
    subject: `Invoice ${inv!.invoice_number} — $${inv!.total.toFixed(2)} — ${shopName}`,
    html: `<div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;background:#fff;color:#1a1a1a"><div style="background:#0B0D11;padding:24px 28px;color:#fff"><div style="font-size:20px;font-weight:800">${shopName}</div><div style="font-size:12px;color:#7C8BA0">${shop!.address || ''} | ${shop!.phone || ''}</div></div><div style="padding:28px"><p>Hi ${cust!.contact_name || cust!.company_name},</p><p>Please find your invoice attached.</p><div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;text-align:center"><div style="font-size:12px;color:#6B7280">Invoice ${inv!.invoice_number}</div><div style="font-size:28px;font-weight:800;color:#1D6FE8">$${inv!.total.toFixed(2)}</div></div><p style="color:#6B7280;font-size:13px">Payment instructions are included in the attached invoice. Please include invoice number <strong>${inv!.invoice_number}</strong> with your payment.</p></div><div style="background:#f8f9fa;padding:16px 28px;font-size:11px;color:#9CA3AF;text-align:center">${shopName} | ${shop!.phone || ''} | ${shop!.email || ''}</div></div>`,
    attachments: [{ filename: result.filename, content: Buffer.from(result.pdfBytes) }],
  })
  console.log('Email:', JSON.stringify(r))
}
main()
