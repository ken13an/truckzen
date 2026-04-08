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
const EMAIL = 'kenanagasiyev@gmail.com'

async function findOrCreateCustomer(name: string, extra: Record<string, any>) {
  const { data: existing } = await s.from('customers').select('id').eq('shop_id', SHOP).eq('company_name', name).limit(1).single()
  if (existing) return existing.id
  const { data } = await s.from('customers').insert({ shop_id: SHOP, company_name: name, email: EMAIL, ...extra }).select('id').single()
  return data!.id
}

async function createWO(soNumber: string, custId: string, assetData: Record<string, any>, ownership: string, complaint: string, jobs: { desc: string; hrs: number; parts: { name: string; pn: string; sell: number; qty: number }[] }[]) {
  const { data: asset } = await s.from('assets').insert({ shop_id: SHOP, customer_id: custId, status: 'in_shop', ownership_type: ownership, ...assetData }).select('id').single()
  const { data: wo } = await s.from('service_orders').insert({
    shop_id: SHOP, so_number: soNumber, status: 'done', source: 'walk_in',
    asset_id: asset!.id, customer_id: custId, ownership_type: ownership,
    complaint, priority: 'normal', is_historical: false, invoice_status: 'accounting_review',
  }).select('id').single()

  for (const job of jobs) {
    const { data: laborLine } = await s.from('so_lines').insert({
      so_id: wo!.id, line_type: 'labor', description: job.desc,
      estimated_hours: job.hrs, unit_price: 0, quantity: 1, line_status: 'completed'
    }).select('id').single()
    for (const p of job.parts) {
      await s.from('so_lines').insert({
        so_id: wo!.id, line_type: 'part', description: p.name, real_name: p.name,
        part_number: p.pn, quantity: p.qty, parts_sell_price: p.sell, unit_price: p.sell,
        parts_status: 'installed', related_labor_line_id: laborLine!.id
      })
    }
  }
  return wo!.id
}

async function approveAndSend(woId: string) {
  const { data: wo } = await s.from('service_orders')
    .select('id, so_number, shop_id, customer_id, asset_id, ownership_type, assets(ownership_type)')
    .eq('id', woId).single()

  const { data: allLines } = await s.from('so_lines')
    .select('id, line_type, description, real_name, rough_name, quantity, unit_price, total_price, parts_status, parts_sell_price, parts_cost_price, billed_hours, estimated_hours, actual_hours')
    .eq('so_id', wo!.id)
  const lines = allLines || []

  const { data: shop } = await s.from('shops').select('tax_rate, tax_labor, labor_rate, default_labor_rate').eq('id', wo!.shop_id).single()
  const taxRate = shop?.tax_rate || 0
  const woOwnership = wo!.ownership_type || (wo!.assets as any)?.ownership_type || 'outside_customer'
  const { data: rateRow } = await s.from('shop_labor_rates').select('rate_per_hour').eq('shop_id', wo!.shop_id).eq('ownership_type', woOwnership).single()
  const laborRate = rateRow?.rate_per_hour || shop?.labor_rate || shop?.default_labor_rate || 125

  const { laborTotal, partsTotal, subtotal, taxAmount, grandTotal: total } = calcWoOperationalTotals(lines, laborRate, taxRate, !!shop?.tax_labor)

  for (const l of lines) {
    if (l.line_type === 'labor' && (l.unit_price || 0) !== laborRate) {
      await s.from('so_lines').update({ unit_price: laborRate }).eq('id', l.id)
    }
  }

  await s.from('service_orders').update({ labor_total: laborTotal, parts_total: partsTotal, grand_total: total }).eq('id', wo!.id)

  const { count } = await s.from('invoices').select('*', { count: 'exact', head: true }).eq('shop_id', wo!.shop_id)
  const invNum = `INV-2026-${String((count || 0) + 1).padStart(4, '0')}`
  const { data: inv, error: invErr } = await s.from('invoices').insert({
    shop_id: wo!.shop_id, so_id: wo!.id, customer_id: wo!.customer_id,
    invoice_number: invNum, status: 'sent', subtotal, tax_amount: taxAmount, total,
    amount_paid: 0, sent_at: new Date().toISOString(),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  }).select('id, invoice_number, total').single()
  if (invErr) { console.log('Invoice insert error:', invErr.message); return }

  await s.from('service_orders').update({
    invoice_status: 'sent', accounting_approved_by: OWNER_ID,
    accounting_approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', wo!.id)

  await s.from('wo_activity_log').insert({ wo_id: wo!.id, user_id: OWNER_ID, action: 'Accounting approved and sent invoice to customer' })

  console.log(`${wo!.so_number} | ${woOwnership} | $${laborRate}/hr | labor=$${laborTotal} parts=$${partsTotal} tax=$${taxAmount.toFixed(2)} total=$${total.toFixed(2)} | ${inv!.invoice_number}`)

  // Send email using real modules
  const { data: cust } = await s.from('customers').select('email, company_name, contact_name, phone').eq('id', wo!.customer_id).single()
  if (!cust?.email) { console.log('  → No email'); return }

  const shopInfo = await getShopInfo(wo!.shop_id)
  const { data: asset } = await s.from('assets').select('unit_number').eq('id', wo!.asset_id).single()

  const { subject, html } = truckReadyEmail({
    customerName: cust.contact_name || cust.company_name || 'Customer',
    unitNumber: asset?.unit_number || '',
    invoiceNumber: inv!.invoice_number, amount: inv!.total.toFixed(2),
    shop: { name: shopInfo.name, phone: shopInfo.phone },
  })

  let attachments: { filename: string; content: Buffer }[] | undefined
  try {
    const pdfResult = await generateInvoicePdf(inv!.id)
    if (pdfResult) attachments = [{ filename: pdfResult.filename, content: Buffer.from(pdfResult.pdfBytes) }]
  } catch {}

  const sent = await sendEmail(cust.email, subject, html, attachments)
  console.log(`  → Email: ${sent ? 'SENT' : 'FAILED'}`)
}

async function main() {
  // 1. Owner Operator
  const c1 = await findOrCreateCustomer('Kamil Transport LLC', { contact_name: 'Kamil', phone: '555-1001', customer_type: 'owner_operator', is_owner_operator: true })
  const wo1 = await createWO('WO-OO-V4', c1,
    { unit_number: 'KT-304', year: 2022, make: 'Peterbilt', model: '579' },
    'owner_operator', 'Engine oil leak from rear main seal + turbo boost low', [
      { desc: 'Remove transmission, replace rear main seal', hrs: 8, parts: [
        { name: 'Rear Main Seal Kit — Cummins X15', pn: 'CUM-4965569', sell: 189, qty: 1 },
        { name: 'Allison TES-295 Transmission Fluid (1 gal)', pn: 'ALL-29546977', sell: 38, qty: 3 },
      ]},
      { desc: 'Turbo boost diagnostic and wastegate actuator replacement', hrs: 3, parts: [
        { name: 'Turbo Wastegate Actuator — Holset HE400', pn: 'HOL-4034315', sell: 345, qty: 1 },
      ]},
    ])

  // 2. Fleet Asset
  const c2 = await findOrCreateCustomer('United Group Logistics Fleet', { contact_name: 'Dispatch Office', phone: '555-2002', customer_type: 'company', is_fleet: true })
  const wo2 = await createWO('WO-FLEET-V4', c2,
    { unit_number: 'UGL-5503', year: 2023, make: 'Freightliner', model: 'Cascadia' },
    'fleet_asset', 'DOT annual inspection + brake chamber replacement driver side', [
      { desc: 'DOT annual safety inspection — full truck + trailer', hrs: 2, parts: [
        { name: 'DOT Annual Inspection Sticker', pn: 'DOT-STICKER', sell: 15, qty: 1 },
      ]},
      { desc: 'Replace driver side steer brake chamber', hrs: 1.5, parts: [
        { name: 'Type 30 Brake Chamber — Bendix', pn: 'BW-065706', sell: 145, qty: 1 },
        { name: 'Automatic Slack Adjuster — Haldex', pn: 'HAL-40010145', sell: 78, qty: 1 },
      ]},
    ])

  // 3. Outside Customer
  const c3 = await findOrCreateCustomer('Highway Express Inc', { contact_name: 'Mike Johnson', phone: '555-3003', customer_type: 'company' })
  const wo3 = await createWO('WO-OUTSIDE-V4', c3,
    { unit_number: 'HWY-883', year: 2021, make: 'Volvo', model: 'VNL 860' },
    'outside_customer', 'AC not blowing cold + check engine light P0546', [
      { desc: 'AC system diagnostic, evacuate, recharge', hrs: 2, parts: [
        { name: 'R-134a Refrigerant (30 lb cylinder)', pn: 'REF-134A-30', sell: 145, qty: 1 },
        { name: 'AC Compressor Clutch Assembly — Volvo', pn: 'VOL-22344221', sell: 285, qty: 1 },
      ]},
      { desc: 'Diagnose CEL P0546 — exhaust gas temp sensor replacement', hrs: 1.5, parts: [
        { name: 'EGT Sensor — Volvo D13', pn: 'VOL-21531072', sell: 92, qty: 1 },
      ]},
    ])

  console.log('\nApproving and sending...\n')
  await approveAndSend(wo1)
  await approveAndSend(wo2)
  await approveAndSend(wo3)
  console.log('\nDone. Check kenanagasiyev@gmail.com.')
}
main()
