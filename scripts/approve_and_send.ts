import { readFileSync } from 'fs'
const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)/); if (m) process.env[m[1]] = m[2]; }

import { createClient } from '@supabase/supabase-js'
import { calcWoOperationalTotals } from '../src/lib/invoice-calc'
import { generateInvoicePdf } from '../src/lib/pdf/generateInvoicePdf'
import { sendEmail, getShopInfo } from '../src/lib/services/email'
import { truckReadyEmail } from '../src/lib/emails/truckReady'

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const SHOP = '1f927e3e-4fe5-431a-bb7c-dac77501e892'
const OWNER_ID = '844370d0-f529-4e58-9fe8-0602d6c5d2ba'

async function approveWO(soNumber: string) {
  const { data: wo } = await s.from('service_orders')
    .select('id, so_number, shop_id, customer_id, asset_id, ownership_type, assets(ownership_type)')
    .eq('so_number', soNumber).single()
  if (!wo) { console.log(soNumber, 'NOT FOUND'); return }

  // Same as /api/accounting/approve
  const { data: allLines } = await s.from('so_lines')
    .select('id, line_type, description, real_name, rough_name, quantity, unit_price, total_price, parts_status, parts_sell_price, parts_cost_price, billed_hours, estimated_hours, actual_hours')
    .eq('so_id', wo.id)
  const lines = allLines || []

  const { data: shop } = await s.from('shops').select('tax_rate, tax_labor, labor_rate, default_labor_rate').eq('id', wo.shop_id).single()
  const taxRate = shop?.tax_rate || 0

  const woOwnership = wo.ownership_type || (wo.assets as any)?.ownership_type || 'outside_customer'
  const { data: rateRow } = await s.from('shop_labor_rates').select('rate_per_hour').eq('shop_id', wo.shop_id).eq('ownership_type', woOwnership).single()
  const laborRate = rateRow?.rate_per_hour || shop?.labor_rate || shop?.default_labor_rate || 125

  const { laborTotal, partsTotal, subtotal, taxAmount, grandTotal: total } = calcWoOperationalTotals(lines, laborRate, taxRate, !!shop?.tax_labor)

  // Snapshot labor rate
  for (const l of lines) {
    if (l.line_type === 'labor' && (l.unit_price || 0) !== laborRate) {
      await s.from('so_lines').update({ unit_price: laborRate }).eq('id', l.id)
    }
  }

  // Update WO totals
  await s.from('service_orders').update({ labor_total: laborTotal, parts_total: partsTotal, grand_total: total }).eq('id', wo.id)

  // Create invoice
  const { data: existingInv } = await s.from('invoices').select('id').eq('so_id', wo.id).limit(1).single()
  let invId: string
  let invNum: string
  if (!existingInv) {
    const { count } = await s.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', wo.shop_id).is('deleted_at', null)
    invNum = `INV-2026-${String((count || 0) + 1).padStart(4, '0')}`
    const { data: inv } = await s.from('invoices').insert({
      shop_id: wo.shop_id, so_id: wo.id, customer_id: wo.customer_id,
      invoice_number: invNum, status: 'sent', subtotal, tax_amount: taxAmount, total,
      amount_paid: 0, due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    }).select('id, invoice_number').single()
    invId = inv!.id; invNum = inv!.invoice_number
  } else {
    await s.from('invoices').update({ status: 'sent', subtotal, tax_amount: taxAmount, total }).eq('id', existingInv.id)
    invId = existingInv.id
    const { data: invData } = await s.from('invoices').select('invoice_number').eq('id', invId).single()
    invNum = invData!.invoice_number
  }

  // Set sent
  await s.from('service_orders').update({
    invoice_status: 'sent', accounting_approved_by: OWNER_ID,
    accounting_approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', wo.id)

  await s.from('wo_activity_log').insert({ wo_id: wo.id, user_id: OWNER_ID, action: 'Accounting approved and sent invoice to customer' })

  console.log(`${soNumber} | ${woOwnership} | $${laborRate}/hr | labor=$${laborTotal} parts=$${partsTotal} tax=$${taxAmount.toFixed(2)} total=$${total.toFixed(2)} | ${invNum}`)

  // Send email — same as sendPaymentNotifications
  const { data: cust } = await s.from('customers').select('email, company_name, contact_name, phone').eq('id', wo.customer_id).single()
  if (!cust?.email) { console.log('  → No email'); return }

  const shopInfo = await getShopInfo(wo.shop_id)
  const { data: asset } = await s.from('assets').select('unit_number').eq('id', wo.asset_id).single()
  const unitNumber = asset?.unit_number || ''
  const customerName = cust.contact_name || cust.company_name || 'Customer'

  const { subject, html } = truckReadyEmail({
    customerName, unitNumber,
    invoiceNumber: invNum, amount: total.toFixed(2),
    shop: { name: shopInfo.name, phone: shopInfo.phone },
  })

  // PDF attachment
  let attachments: { filename: string; content: Buffer }[] | undefined
  try {
    const pdfResult = await generateInvoicePdf(invId)
    if (pdfResult) attachments = [{ filename: pdfResult.filename, content: Buffer.from(pdfResult.pdfBytes) }]
  } catch {}

  const sent = await sendEmail(cust.email, subject, html, attachments)
  console.log(`  → Email: ${sent ? 'SENT' : 'FAILED'}`)
}

async function main() {
  await approveWO('WO-OO-TEST2')
  await approveWO('WO-FLEET-TEST2')
  await approveWO('WO-OUTSIDE-TEST2')
  console.log('\nDone. Check kenanagasiyev@gmail.com.')
}
main()
