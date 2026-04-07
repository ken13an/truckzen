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
      service_orders(so_number, complaint, cause, correction, mileage_at_service, created_at, ownership_type,
        assets(unit_number, year, make, model, odometer, vin, ownership_type),
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
  const taxRate = shop?.tax_rate || 0

  // Labor rate from shop_labor_rates by ownership type
  const woOwnership = so?.ownership_type || asset?.ownership_type || 'outside_customer'
  const { data: rateRow } = await supabase.from('shop_labor_rates').select('rate_per_hour').eq('shop_id', inv.shop_id).eq('ownership_type', woOwnership).single()
  const laborRate = rateRow?.rate_per_hour || shop?.labor_rate || shop?.default_labor_rate || 125

  const jobLines = lines.filter((l: any) => l.line_type === 'labor')
  const partLines = lines.filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled')
  const orphanParts = partLines.filter((p: any) => !p.related_labor_line_id || !jobLines.some((j: any) => j.id === p.related_labor_line_id))

  const pdf = await PDFDocument.create()
  let page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const dark = rgb(0.12, 0.14, 0.17)
  const mid = rgb(0.35, 0.38, 0.42)
  const light = rgb(0.6, 0.63, 0.67)
  const rule = rgb(0.85, 0.87, 0.89)
  const accent = rgb(0.11, 0.44, 0.91)
  const money = rgb(0.06, 0.52, 0.30)

  let y = 750
  const L = 50, R = 562, W = R - L

  function text(t: string, x: number, yy: number, size = 9, bold = false, color = dark) {
    page.drawText(t || '', { x, y: yy, size, font: bold ? fontBold : font, color })
  }
  function line(yy: number, color = rule) {
    page.drawLine({ start: { x: L, y: yy }, end: { x: R, y: yy }, thickness: 0.5, color })
  }
  function newPage() { page = pdf.addPage([612, 792]); y = 750 }
  function need(h: number) { if (y < h) newPage() }
  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  // ════════════════════════════════════════════════════════
  //  HEADER
  // ════════════════════════════════════════════════════════

  const shopName = shop?.dba || shop?.name || ''
  text(shopName, L, y, 18, true, accent)
  text('INVOICE', R - fontBold.widthOfTextAtSize('INVOICE', 20), y, 20, true, accent)
  y -= 20; line(y, accent); y -= 14

  // Left: shop info
  const shopLines: string[] = []
  if (shop?.address) shopLines.push(shop.address)
  const cityLine = [shop?.city, shop?.state, shop?.zip].filter(Boolean).join(', ')
  if (cityLine) shopLines.push(cityLine)
  if (shop?.phone) shopLines.push(shop.phone)
  if (shop?.email) shopLines.push(shop.email)
  for (const s of shopLines) { text(s, L, y, 8, false, mid); y -= 11 }

  // Right: invoice details (positioned at same starting y as shop lines)
  let ry = y + shopLines.length * 11
  const rx = 400
  const dets = [
    ['Invoice #', inv.invoice_number || ''],
    ['Date', so?.created_at ? new Date(so.created_at).toLocaleDateString() : ''],
    ['Due', inv.due_date || 'On receipt'],
    ['Terms', cust?.payment_terms || 'Due on receipt'],
    ['WO #', so?.so_number || ''],
  ]
  if (asset?.unit_number) dets.push(['Unit #', asset.unit_number])
  for (const [label, val] of dets) {
    text(label, rx, ry, 8, true, light)
    text(val, rx + 55, ry, 8, false, dark)
    ry -= 12
  }

  y = Math.min(y, ry) - 10

  // ════════════════════════════════════════════════════════
  //  BILL TO + VEHICLE
  // ════════════════════════════════════════════════════════

  line(y); y -= 14
  // Bill To (left)
  text('BILL TO', L, y, 8, true, light); y -= 12
  if (cust?.company_name) { text(cust.company_name, L, y, 11, true); y -= 13 }
  if (cust?.contact_name) { text(cust.contact_name, L, y, 9, false, mid); y -= 11 }
  if (cust?.phone) { text(cust.phone, L, y, 8, false, mid); y -= 10 }
  if (cust?.email) { text(cust.email, L, y, 8, false, mid); y -= 10 }

  // Vehicle (right, anchored at same row as bill-to)
  if (asset) {
    let vy = y + 46
    text('VEHICLE', 380, vy, 8, true, light); vy -= 12
    text('#' + (asset.unit_number || ''), 380, vy, 10, true); vy -= 12
    const vh = [asset.year, asset.make, asset.model].filter(Boolean).join(' ')
    if (vh) { text(vh, 380, vy, 9); vy -= 11 }
    if (asset.vin) { text('VIN: ' + asset.vin, 380, vy, 7, false, light); vy -= 10 }
    const mi = so?.mileage_at_service || asset.odometer
    if (mi) text('Mileage: ' + Number(mi).toLocaleString(), 380, vy, 8, false, mid)
  }

  y -= 10

  // ════════════════════════════════════════════════════════
  //  COMPLAINT / CAUSE / CORRECTION
  // ════════════════════════════════════════════════════════

  if (so?.complaint || so?.cause || so?.correction) {
    line(y); y -= 12
    if (so?.complaint) { text('Complaint:', L, y, 8, true, light); text(so.complaint.substring(0, 85), L + 60, y, 8, false, mid); y -= 12 }
    if (so?.cause) { text('Cause:', L, y, 8, true, light); text(so.cause.substring(0, 85), L + 60, y, 8, false, mid); y -= 12 }
    if (so?.correction) { text('Correction:', L, y, 8, true, light); text(so.correction.substring(0, 85), L + 60, y, 8, false, mid); y -= 12 }
    y -= 4
  }

  // ════════════════════════════════════════════════════════
  //  JOB-GROUPED LINE ITEMS
  // ════════════════════════════════════════════════════════

  let totalLabor = 0, totalParts = 0

  for (let i = 0; i < jobLines.length; i++) {
    const job = jobLines[i]
    const hrs = job.billed_hours || job.estimated_hours || 0
    const laborAmt = hrs * laborRate
    const jobParts = partLines.filter((p: any) => p.related_labor_line_id === job.id)
    const partsAmt = jobParts.reduce((s: number, p: any) => s + ((p.parts_sell_price || p.unit_price || 0) * (p.quantity || 1)), 0)
    totalLabor += laborAmt
    totalParts += partsAmt

    need(90)
    line(y, accent); y -= 14

    // Job header
    text(`Job ${i + 1}`, L, y, 8, true, accent)
    text((job.description || '').substring(0, 65), L + 38, y, 10, true)
    y -= 16

    // Labor table header
    text('Description', L + 4, y, 7, true, light)
    text('Hours', 370, y, 7, true, light)
    text('Rate', 430, y, 7, true, light)
    text('Amount', R - 40, y, 7, true, light)
    y -= 4; line(y, rule); y -= 12

    // Labor row
    text((job.description || '').substring(0, 55), L + 4, y, 9)
    text(String(hrs), 375, y, 9)
    text(fmt(laborRate) + '/hr', 422, y, 8, false, mid)
    text(fmt(laborAmt), R - 40, y, 9, true)
    y -= 16

    // Parts for this job
    if (jobParts.length > 0) {
      text('Qty', L + 4, y, 7, true, light)
      text('Part', L + 32, y, 7, true, light)
      text('Part #', 320, y, 7, true, light)
      text('Price', 440, y, 7, true, light)
      text('Amount', R - 40, y, 7, true, light)
      y -= 4; line(y, rule); y -= 12

      for (const p of jobParts) {
        need(24)
        const sell = p.parts_sell_price || p.unit_price || 0
        const qty = p.quantity || 1
        text(String(qty), L + 10, y, 9)
        text((p.real_name || p.rough_name || p.description || '').substring(0, 42), L + 32, y, 9)
        text(p.part_number || '', 320, y, 7, false, light)
        text(fmt(sell), 438, y, 9)
        text(fmt(sell * qty), R - 40, y, 9)
        y -= 13
      }
    }

    // Job total
    y -= 2; line(y + 4, rule); y -= 10
    const jobTotal = laborAmt + partsAmt
    text(`Labor: ${fmt(laborAmt)}`, 340, y, 8, false, mid)
    if (jobParts.length > 0) text(`Parts: ${fmt(partsAmt)}`, 420, y, 8, false, mid)
    y -= 12
    text('Job Total', R - 120, y, 9, true, mid)
    text(fmt(jobTotal), R - 40, y, 10, true)
    y -= 18
  }

  // ════════════════════════════════════════════════════════
  //  ORPHAN PARTS
  // ════════════════════════════════════════════════════════

  if (orphanParts.length > 0) {
    need(60)
    line(y, accent); y -= 14
    text('Additional Parts', L, y, 10, true)
    y -= 16

    text('Qty', L + 4, y, 7, true, light)
    text('Part', L + 32, y, 7, true, light)
    text('Part #', 320, y, 7, true, light)
    text('Price', 440, y, 7, true, light)
    text('Amount', R - 40, y, 7, true, light)
    y -= 4; line(y, rule); y -= 12

    for (const p of orphanParts) {
      need(20)
      const sell = p.parts_sell_price || p.unit_price || 0
      const qty = p.quantity || 1
      totalParts += sell * qty
      text(String(qty), L + 10, y, 9)
      text((p.real_name || p.rough_name || p.description || '').substring(0, 42), L + 32, y, 9)
      text(p.part_number || '', 320, y, 7, false, light)
      text(fmt(sell), 438, y, 9)
      text(fmt(sell * qty), R - 40, y, 9)
      y -= 13
    }
    y -= 8
  }

  // ════════════════════════════════════════════════════════
  //  TOTALS
  // ════════════════════════════════════════════════════════

  need(100)
  y -= 4; line(y, accent); y -= 16

  const subtotal = totalLabor + totalParts
  const taxable = totalParts + (shop?.tax_labor ? totalLabor : 0)
  const tax = taxRate > 0 ? taxable * (taxRate / 100) : 0
  const total = subtotal + tax
  const sx = R - 170

  text(`Labor (${jobLines.length} ${jobLines.length === 1 ? 'job' : 'jobs'})`, sx, y, 10)
  text(fmt(totalLabor), R - 40, y, 10, true); y -= 16

  text(`Parts (${partLines.length} ${partLines.length === 1 ? 'item' : 'items'})`, sx, y, 10)
  text(fmt(totalParts), R - 40, y, 10, true); y -= 16

  line(y + 4, rule); y -= 12
  text('Subtotal', sx, y, 10, false, mid)
  text(fmt(subtotal), R - 40, y, 10, true); y -= 16

  if (tax > 0) {
    text(`Tax (${taxRate}%${shop?.tax_labor ? ' incl. labor' : ' parts only'})`, sx, y, 9, false, mid)
    text(fmt(tax), R - 40, y, 9); y -= 16
  } else {
    text('Tax', sx, y, 9, false, mid); text('Exempt', R - 50, y, 9, false, light); y -= 16
  }

  line(y + 4, accent); y -= 14
  text('Total', sx, y, 14, true)
  text(fmt(total), R - 45, y, 14, true, money)
  y -= 24

  // ════════════════════════════════════════════════════════
  //  PAYMENT INSTRUCTIONS
  // ════════════════════════════════════════════════════════

  if (shop?.payment_payee_name) {
    need(70)
    line(y, rule); y -= 14
    text('PAYMENT INSTRUCTIONS', L, y, 9, true, accent)
    y -= 14

    text('Payable to: ' + shop.payment_payee_name, L, y, 9, true)
    if (shop.payment_bank_name) { text('Bank: ' + shop.payment_bank_name, L + 250, y, 8, false, mid) }
    y -= 16

    if (shop.payment_ach_account) {
      text('ACH', L, y, 7, true, light)
      text('Account: ' + shop.payment_ach_account + (shop.payment_ach_routing ? '   Routing: ' + shop.payment_ach_routing : ''), L + 30, y, 8)
      y -= 12
    }
    if (shop.payment_wire_account) {
      text('Wire', L, y, 7, true, light)
      text('Account: ' + shop.payment_wire_account + (shop.payment_wire_routing ? '   Routing: ' + shop.payment_wire_routing : ''), L + 30, y, 8)
      y -= 12
    }
    if (shop.payment_zelle_email_1) {
      text('Zelle', L, y, 7, true, light)
      text(shop.payment_zelle_email_1 + (shop.payment_zelle_email_2 ? '  /  ' + shop.payment_zelle_email_2 : ''), L + 30, y, 8)
      y -= 12
    }
    if (shop.payment_mail_payee) {
      text('Mail', L, y, 7, true, light)
      text(shop.payment_mail_payee + ', ' + [shop.payment_mail_address, shop.payment_mail_city, shop.payment_mail_state, shop.payment_mail_zip].filter(Boolean).join(', '), L + 30, y, 8)
      y -= 12
    }

    y -= 8
    text(`Please reference invoice #${inv.invoice_number || ''} with your payment.  Also accepted: Cash, Check, Credit/Debit Card.`, L, y, 7, false, light)
  }

  // ════════════════════════════════════════════════════════
  //  FOOTER
  // ════════════════════════════════════════════════════════

  const footerY = 28
  page.drawLine({ start: { x: L, y: footerY + 8 }, end: { x: R, y: footerY + 8 }, thickness: 0.3, color: rule })
  text(`${shopName}  |  ${shop?.phone || ''}  |  ${shop?.email || ''}`, L, footerY, 7, false, light)
  text('Powered by TruckZen', R - fontBold.widthOfTextAtSize('Powered by TruckZen', 6), footerY, 6, false, light)

  const pdfBytes = await pdf.save()
  return { pdfBytes, filename: `Invoice-${inv.invoice_number || invoiceId}.pdf` }
}
