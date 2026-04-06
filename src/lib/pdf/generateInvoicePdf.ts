import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function generateInvoicePdf(invoiceId: string): Promise<{ pdfBytes: Uint8Array; filename: string } | null> {
  const supabase = db()

  const { data: inv } = await supabase
    .from('invoices')
    .select(`
      *,
      service_orders(so_number, complaint, cause, correction, mileage_at_service, created_at,
        assets(unit_number, year, make, model, odometer, vin),
        users!assigned_tech(full_name),
        so_lines(id, line_type, description, real_name, rough_name, part_number, quantity, unit_price, total_price, parts_sell_price, parts_cost_price, billed_hours, estimated_hours, actual_hours, parts_status, related_labor_line_id)
      ),
      customers(company_name, contact_name, phone, email, address, payment_terms),
      shops(name, dba, phone, email, address, city, state, zip, labor_rate, default_labor_rate, tax_rate, tax_labor,
        payment_payee_name, payment_bank_name, payment_ach_account, payment_ach_routing,
        payment_wire_account, payment_wire_routing, payment_zelle_email_1, payment_zelle_email_2,
        payment_mail_payee, payment_mail_address, payment_mail_city, payment_mail_state, payment_mail_zip)
    `)
    .eq('id', invoiceId)
    .single()

  if (!inv) return null

  const so = inv.service_orders as any
  const asset = so?.assets as any
  const shop = inv.shops as any
  const cust = inv.customers as any
  const lines: any[] = so?.so_lines || []
  const laborRate = shop?.labor_rate || shop?.default_labor_rate || 125
  const taxRate = shop?.tax_rate || 0

  const jobLines = lines.filter((l: any) => l.line_type === 'labor')
  const partLines = lines.filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled')
  const orphanParts = partLines.filter((p: any) => !p.related_labor_line_id || !jobLines.some((j: any) => j.id === p.related_labor_line_id))

  const pdf = await PDFDocument.create()
  let page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const black = rgb(0.1, 0.1, 0.1), gray = rgb(0.4, 0.4, 0.4), lightGray = rgb(0.88, 0.88, 0.88)
  const blue = rgb(0.11, 0.44, 0.91), green = rgb(0.05, 0.6, 0.32)

  let y = 745
  const L = 45, R = 567

  function dT(t: string, x: number, yy: number, o?: { f?: typeof font; s?: number; c?: typeof black }) {
    page.drawText(t || '', { x, y: yy, size: o?.s || 10, font: o?.f || font, color: o?.c || black })
  }
  function dL(x1: number, yy: number, x2: number, c?: typeof black) {
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.5, color: c || lightGray })
  }
  function checkPage(need: number) {
    if (y < need) { page = pdf.addPage([612, 792]); y = 745 }
  }
  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  // ── HEADER ──
  const shopName = shop?.dba || shop?.name || ''
  dT(shopName, L, y, { f: fontBold, s: 16, c: blue }); y -= 15
  if (shop?.address) { dT(shop.address, L, y, { s: 8, c: gray }); y -= 11 }
  const scl = [shop?.city, shop?.state, shop?.zip].filter(Boolean).join(', ')
  if (scl) { dT(scl, L, y, { s: 8, c: gray }); y -= 11 }
  if (shop?.phone) { dT(shop.phone, L, y, { s: 8, c: gray }); y -= 11 }
  if (shop?.email) { dT(shop.email, L, y, { s: 8, c: gray }); y -= 11 }

  dT('INVOICE', R - fontBold.widthOfTextAtSize('INVOICE', 22), 745, { f: fontBold, s: 22, c: blue })
  const stl = inv.status === 'paid' ? 'PAID' : inv.status === 'sent' ? 'SENT' : ''
  if (stl) dT(stl, R - fontBold.widthOfTextAtSize(stl, 10), 728, { f: fontBold, s: 10, c: inv.status === 'paid' ? green : gray })

  // ── INVOICE DETAILS (right) ──
  let ry = 712
  const details = [
    { l: 'Invoice #:', v: inv.invoice_number || '' },
    { l: 'Date:', v: so?.created_at ? new Date(so.created_at).toLocaleDateString() : '' },
    { l: 'Due Date:', v: inv.due_date || '' },
    { l: 'Terms:', v: cust?.payment_terms || 'Due on receipt' },
    { l: 'WO #:', v: so?.so_number || '' },
    ...(asset?.unit_number ? [{ l: 'Unit #:', v: asset.unit_number }] : []),
  ]
  for (const d of details) {
    const lw = fontBold.widthOfTextAtSize(d.l, 8)
    dT(d.l, R - 145, ry, { f: fontBold, s: 8, c: gray })
    dT(d.v, R - 145 + lw + 5, ry, { s: 8 })
    ry -= 12
  }

  // ── BILL TO ──
  y = Math.min(y, ry) - 16
  dL(L, y + 6, R); y -= 2
  dT('BILL TO', L, y, { f: fontBold, s: 8, c: gray }); y -= 12
  if (cust?.company_name) { dT(cust.company_name, L, y, { f: fontBold, s: 10 }); y -= 12 }
  if (cust?.contact_name) { dT(cust.contact_name, L, y, { s: 8, c: gray }); y -= 10 }
  if (cust?.phone) { dT(cust.phone, L, y, { s: 8, c: gray }); y -= 10 }
  if (cust?.email) { dT(cust.email, L, y, { s: 8, c: gray }); y -= 10 }

  // ── VEHICLE (right of bill to) ──
  if (asset) {
    const vy0 = y + 42
    dT('UNIT', R - 190, vy0, { f: fontBold, s: 8, c: gray })
    let vy = vy0 - 12
    dT('#' + (asset.unit_number || ''), R - 190, vy, { f: fontBold, s: 9 }); vy -= 11
    const vs = [asset.year, asset.make, asset.model].filter(Boolean).join(' ')
    if (vs) { dT(vs, R - 190, vy, { s: 8 }); vy -= 10 }
    if (asset.vin) { dT('VIN: ' + asset.vin, R - 190, vy, { s: 7, c: gray }); vy -= 10 }
    const mi = so?.mileage_at_service || asset.odometer
    if (mi) dT('Mileage: ' + Number(mi).toLocaleString(), R - 190, vy, { s: 8, c: gray })
  }

  // ── COMPLAINT ──
  y -= 8
  if (so?.complaint) { dT('Complaint: ' + (so.complaint || '').substring(0, 90), L, y, { s: 8, c: gray }); y -= 10 }
  if (so?.cause) { dT('Cause: ' + (so.cause || '').substring(0, 90), L, y, { s: 8, c: gray }); y -= 10 }
  if (so?.correction) { dT('Correction: ' + (so.correction || '').substring(0, 90), L, y, { s: 8, c: gray }); y -= 10 }

  // ── JOB-GROUPED BODY ──
  y -= 6
  let totalLaborAmt = 0, totalPartsAmt = 0

  for (let idx = 0; idx < jobLines.length; idx++) {
    const line = jobLines[idx]
    const hrs = line.billed_hours || line.estimated_hours || 0
    const jobLaborAmt = hrs * laborRate
    const jobParts = partLines.filter((p: any) => p.related_labor_line_id === line.id)
    const jobPartsTotal = jobParts.reduce((s: number, p: any) => s + ((p.parts_sell_price || p.unit_price || 0) * (p.quantity || 1)), 0)
    totalLaborAmt += jobLaborAmt
    totalPartsAmt += jobPartsTotal

    checkPage(100)

    // Job header
    dL(L, y + 4, R, blue); y -= 2
    dT(`JOB ${idx + 1}`, L, y, { f: fontBold, s: 8, c: gray })
    dT((line.description || `Job ${idx + 1}`).substring(0, 60), L + 40, y, { f: fontBold, s: 9 })
    y -= 14

    // Labor row
    dT('Labor', L + 4, y, { f: fontBold, s: 7, c: gray })
    dT('Hours', 350, y, { f: fontBold, s: 7, c: gray })
    dT('Rate', 420, y, { f: fontBold, s: 7, c: gray })
    dT('Amount', R - 45, y, { f: fontBold, s: 7, c: gray })
    y -= 10; dL(L + 4, y + 2, R - 4, lightGray); y -= 10
    dT((line.description || '').substring(0, 50), L + 4, y, { s: 9 })
    dT(String(hrs), 355, y, { s: 9 })
    dT(fmt(laborRate) + '/hr', 410, y, { s: 8, c: gray })
    dT(fmt(jobLaborAmt), R - 45, y, { f: fontBold, s: 9 })
    y -= 14

    // Parts for this job
    if (jobParts.length > 0) {
      dT('Qty', L + 4, y, { f: fontBold, s: 7, c: gray })
      dT('Parts', L + 30, y, { f: fontBold, s: 7, c: gray })
      dT('Part #', 310, y, { f: fontBold, s: 7, c: gray })
      dT('Sell', 430, y, { f: fontBold, s: 7, c: gray })
      dT('Amount', R - 45, y, { f: fontBold, s: 7, c: gray })
      y -= 10; dL(L + 4, y + 2, R - 4, lightGray); y -= 10

      for (const p of jobParts) {
        checkPage(30)
        const sell = p.parts_sell_price || p.unit_price || 0
        const qty = p.quantity || 1
        const lt = sell * qty
        dT(String(qty), L + 8, y, { s: 8 })
        dT((p.real_name || p.rough_name || p.description || '—').substring(0, 40), L + 30, y, { s: 8 })
        dT(p.part_number || '—', 310, y, { s: 7, c: gray })
        dT(fmt(sell), 425, y, { s: 8 })
        dT(fmt(lt), R - 45, y, { s: 8 })
        y -= 11
      }
    }

    // Job recap
    y -= 2; dL(L + 4, y + 4, R - 4, lightGray); y -= 8
    dT(`Labor: ${fmt(jobLaborAmt)}`, 330, y, { s: 8, c: gray })
    if (jobParts.length > 0) dT(`Parts: ${fmt(jobPartsTotal)}`, 410, y, { s: 8, c: gray })
    dT(`Job Total: ${fmt(jobLaborAmt + jobPartsTotal)}`, R - 90, y, { f: fontBold, s: 8 })
    y -= 16
  }

  // ── ORPHAN PARTS ──
  if (orphanParts.length > 0) {
    checkPage(60)
    dL(L, y + 4, R, blue); y -= 2
    dT('ADDITIONAL PARTS', L, y, { f: fontBold, s: 8, c: gray })
    dT(`(${orphanParts.length} ${orphanParts.length === 1 ? 'item' : 'items'})`, L + 95, y, { s: 7, c: gray })
    y -= 14

    dT('Qty', L + 4, y, { f: fontBold, s: 7, c: gray })
    dT('Part', L + 30, y, { f: fontBold, s: 7, c: gray })
    dT('Part #', 310, y, { f: fontBold, s: 7, c: gray })
    dT('Sell', 430, y, { f: fontBold, s: 7, c: gray })
    dT('Amount', R - 45, y, { f: fontBold, s: 7, c: gray })
    y -= 10; dL(L + 4, y + 2, R - 4, lightGray); y -= 10

    for (const p of orphanParts) {
      checkPage(20)
      const sell = p.parts_sell_price || p.unit_price || 0
      const qty = p.quantity || 1
      const lt = sell * qty
      totalPartsAmt += lt
      dT(String(qty), L + 8, y, { s: 8 })
      dT((p.real_name || p.rough_name || p.description || '—').substring(0, 40), L + 30, y, { s: 8 })
      dT(p.part_number || '—', 310, y, { s: 7, c: gray })
      dT(fmt(sell), 425, y, { s: 8 })
      dT(fmt(lt), R - 45, y, { s: 8 })
      y -= 11
    }
    y -= 6
  }

  // ── SUMMARY & TOTALS ──
  checkPage(120)
  y -= 4; dL(L, y + 4, R, blue); y -= 4
  dT('SUMMARY', L, y, { f: fontBold, s: 9, c: blue }); y -= 16

  const subtotal = totalLaborAmt + totalPartsAmt
  const taxableAmt = totalPartsAmt + (shop?.tax_labor ? totalLaborAmt : 0)
  const taxAmt = taxRate > 0 ? taxableAmt * (taxRate / 100) : 0
  const grandTotal = subtotal + taxAmt

  const summaryX = R - 180

  dT(`Labor (${jobLines.length} ${jobLines.length === 1 ? 'job' : 'jobs'})`, summaryX, y, { s: 9 })
  dT(fmt(totalLaborAmt), R - 45, y, { f: fontBold, s: 9 }); y -= 14

  dT(`Parts (${partLines.length} ${partLines.length === 1 ? 'item' : 'items'})`, summaryX, y, { s: 9 })
  dT(fmt(totalPartsAmt), R - 45, y, { f: fontBold, s: 9 }); y -= 14

  dL(summaryX, y + 4, R - 4); y -= 8
  dT('Subtotal', summaryX, y, { s: 9, c: gray }); dT(fmt(subtotal), R - 45, y, { f: fontBold, s: 9 }); y -= 14

  if (taxAmt > 0) {
    dT(`Tax (${taxRate}%${shop?.tax_labor ? ' incl. labor' : ' parts only'})`, summaryX, y, { s: 9, c: gray })
    dT(fmt(taxAmt), R - 45, y, { s: 9 }); y -= 14
  } else {
    dT('Tax', summaryX, y, { s: 9, c: gray }); dT('Exempt', R - 60, y, { s: 8, c: gray }); y -= 14
  }

  dL(summaryX, y + 4, R - 4, blue); y -= 8
  dT('Invoice Total', summaryX, y, { f: fontBold, s: 12 })
  dT(fmt(grandTotal), R - 50, y, { f: fontBold, s: 13, c: green }); y -= 18

  if ((inv.amount_paid || 0) > 0) {
    dT('Amount Paid', summaryX, y, { s: 9, c: green }); dT('-' + fmt(inv.amount_paid), R - 45, y, { s: 9, c: green }); y -= 14
  }
  dT('Balance Due', summaryX, y, { f: fontBold, s: 11 })
  dT(fmt(inv.balance_due ?? grandTotal), R - 45, y, { f: fontBold, s: 11, c: (inv.balance_due ?? grandTotal) > 0 ? black : green }); y -= 20

  // ── PAYMENT INSTRUCTIONS ──
  if ((inv.balance_due ?? grandTotal) > 0 && shop?.payment_payee_name) {
    checkPage(80)
    dL(L, y + 4, R, blue); y -= 4
    dT('PAYMENT INSTRUCTIONS', L, y, { f: fontBold, s: 9, c: blue })
    dT('Payable to: ' + shop.payment_payee_name, R - 200, y, { s: 8, c: gray })
    y -= 14

    if (shop.payment_bank_name) { dT('Bank: ' + shop.payment_bank_name, L, y, { s: 8, c: gray }); y -= 12 }

    const methods: string[][] = []
    if (shop.payment_ach_account) methods.push(['ACH Payment', `Account: ${shop.payment_ach_account}`, shop.payment_ach_routing ? `Routing: ${shop.payment_ach_routing}` : ''])
    if (shop.payment_wire_account) methods.push(['Wire Transfer', `Account: ${shop.payment_wire_account}`, shop.payment_wire_routing ? `Routing: ${shop.payment_wire_routing}` : ''])
    if (shop.payment_zelle_email_1) methods.push(['Zelle', shop.payment_zelle_email_1, shop.payment_zelle_email_2 || ''])
    if (shop.payment_mail_payee) methods.push(['Mail Check To', shop.payment_mail_payee, [shop.payment_mail_address, shop.payment_mail_city, shop.payment_mail_state, shop.payment_mail_zip].filter(Boolean).join(', ')])

    for (const m of methods) {
      checkPage(40)
      dT(m[0].toUpperCase(), L, y, { f: fontBold, s: 7, c: gray }); y -= 10
      if (m[1]) { dT(m[1], L, y, { s: 8 }); y -= 10 }
      if (m[2]) { dT(m[2], L, y, { s: 8 }); y -= 10 }
      y -= 4
    }

    y -= 2
    dT(`Please include invoice #${inv.invoice_number || ''} with your payment. Also accepted: Cash, Check, Credit/Debit Card.`, L, y, { s: 7, c: gray })
  }

  // ── DUE DATE ──
  if (inv.due_date) {
    y -= 14; dT('Payment due by ' + inv.due_date, L, y, { s: 8, c: gray })
  }

  const pdfBytes = await pdf.save()
  return { pdfBytes, filename: `Invoice-${inv.invoice_number || invoiceId}.pdf` }
}
