import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  try { const dt = new Date(d); return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}` }
  catch { return d || '' }
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

  const woOwnership = so?.ownership_type || asset?.ownership_type || 'outside_customer'
  const { data: rateRow } = await supabase.from('shop_labor_rates').select('rate_per_hour').eq('shop_id', inv.shop_id).eq('ownership_type', woOwnership).single()
  const laborRate = rateRow?.rate_per_hour || shop?.labor_rate || shop?.default_labor_rate || DEFAULT_LABOR_RATE_FALLBACK

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
  const L = 50
  const R = 562
  const BOTTOM = 65 // minimum Y before page break — leaves room for footer
  const LINE_H = 14 // standard line height
  const shopName = shop?.dba || shop?.name || ''
  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  function drawFooter() {
    page.drawLine({ start: { x: L, y: 38 }, end: { x: R, y: 38 }, thickness: 0.3, color: rule })
    page.drawText(`${shopName}  |  ${shop?.phone || ''}  |  ${shop?.email || ''}`, { x: L, y: 28, size: 7, font, color: light })
    page.drawText('Powered by TruckZen', { x: R - font.widthOfTextAtSize('Powered by TruckZen', 6), y: 28, size: 6, font, color: light })
  }

  function newPage() {
    drawFooter()
    page = pdf.addPage([612, 792])
    y = 750
  }

  function need(h: number) {
    if (y - h < BOTTOM) newPage()
  }

  function txt(t: string, x: number, yPos: number, size = 9, bold = false, color = dark) {
    page.drawText(t || '', { x, y: yPos, size, font: bold ? fontBold : font, color })
  }

  function hr(yPos: number, color = rule) {
    page.drawLine({ start: { x: L, y: yPos }, end: { x: R, y: yPos }, thickness: 0.5, color })
  }

  function wrap(t: string, x: number, maxW: number, size: number, bold: boolean, color: typeof dark) {
    const f = bold ? fontBold : font
    const words = (t || '').split(' ')
    let ln = ''
    for (const word of words) {
      const test = ln ? ln + ' ' + word : word
      if (f.widthOfTextAtSize(test, size) > maxW && ln) {
        need(LINE_H)
        txt(ln, x, y, size, bold, color)
        y -= size + 3
        ln = word
      } else { ln = test }
    }
    if (ln) { need(LINE_H); txt(ln, x, y, size, bold, color); y -= size + 3 }
  }

  // ═══════════════════════════════════════════════════════════
  //  HEADER
  // ═══════════════════════════════════════════════════════════

  txt(shopName, L, y, 16, true, accent)
  txt('INVOICE', R - fontBold.widthOfTextAtSize('INVOICE', 18), y, 18, true, accent)
  y -= 22
  hr(y, accent)
  y -= 16

  // Shop info (left)
  const shopAddr = shop?.address || ''
  const shopCity = [shop?.city, shop?.state, shop?.zip].filter(Boolean).join(', ')
  if (shopAddr) { txt(shopAddr, L, y, 8, false, mid); y -= 12 }
  if (shopCity && !shopAddr.includes(shop?.city || '___')) { txt(shopCity, L, y, 8, false, mid); y -= 12 }
  if (shop?.phone) { txt(shop.phone, L, y, 8, false, mid); y -= 12 }
  if (shop?.email) { txt(shop.email, L, y, 8, false, mid); y -= 12 }

  // Invoice details (right column)
  let ry = y + 48
  const dets: [string, string][] = [
    ['Invoice #', inv.invoice_number || ''],
    ['Date', fmtDate(so?.created_at || inv.created_at)],
    ['Due Date', fmtDate(inv.due_date) || 'On receipt'],
    ['Terms', cust?.payment_terms || 'Due on receipt'],
    ['WO #', so?.so_number || ''],
  ]
  if (asset?.unit_number) dets.push(['Unit #', asset.unit_number])
  for (const [label, val] of dets) {
    txt(label, 400, ry, 8, true, light)
    txt(val, 460, ry, 8, false, dark)
    ry -= 13
  }
  y = Math.min(y, ry) - 16

  // ═══════════════════════════════════════════════════════════
  //  BILL TO + VEHICLE (two columns)
  // ═══════════════════════════════════════════════════════════

  need(60)
  hr(y)
  y -= 16
  const colStart = y

  // Left: Bill To
  let ly = colStart
  txt('BILL TO', L, ly, 8, true, light); ly -= 14
  if (cust?.company_name) { txt(cust.company_name, L, ly, 10, true); ly -= 14 }
  if (cust?.contact_name) { txt(cust.contact_name, L, ly, 8, false, mid); ly -= 12 }
  if (cust?.phone) { txt(cust.phone, L, ly, 8, false, mid); ly -= 12 }
  if (cust?.email) { txt(cust.email, L, ly, 8, false, mid); ly -= 12 }
  if (cust?.address) { txt(cust.address, L, ly, 8, false, mid); ly -= 12 }

  // Right: Vehicle
  let vy = colStart
  if (asset) {
    txt('VEHICLE', 340, vy, 8, true, light); vy -= 14
    txt('#' + (asset.unit_number || ''), 340, vy, 10, true); vy -= 14
    const vh = [asset.year, asset.make, asset.model].filter(Boolean).join(' ')
    if (vh) { txt(vh, 340, vy, 9); vy -= 12 }
    if (asset.vin) { txt('VIN: ' + asset.vin, 340, vy, 7, false, light); vy -= 12 }
    const mi = so?.mileage_at_service || asset.odometer
    if (mi) { txt('Mileage: ' + Number(mi).toLocaleString(), 340, vy, 8, false, mid); vy -= 12 }
  }
  y = Math.min(ly, vy) - 16

  // ═══════════════════════════════════════════════════════════
  //  COMPLAINT / CAUSE / CORRECTION
  // ═══════════════════════════════════════════════════════════

  if (so?.complaint || so?.cause || so?.correction) {
    need(30)
    hr(y); y -= 14
    if (so?.complaint) { txt('Complaint:', L, y, 8, true, light); y -= 12; wrap(so.complaint, L + 4, R - L - 8, 8, false, mid); y -= 4 }
    if (so?.cause) { txt('Cause:', L, y, 8, true, light); y -= 12; wrap(so.cause, L + 4, R - L - 8, 8, false, mid); y -= 4 }
    if (so?.correction) { txt('Correction:', L, y, 8, true, light); y -= 12; wrap(so.correction, L + 4, R - L - 8, 8, false, mid); y -= 4 }
    y -= 6
  }

  // ═══════════════════════════════════════════════════════════
  //  JOB-GROUPED LINE ITEMS
  // ═══════════════════════════════════════════════════════════

  let totalLabor = 0
  let totalParts = 0

  for (let i = 0; i < jobLines.length; i++) {
    const job = jobLines[i]
    const hrs = job.billed_hours || job.estimated_hours || 0
    const laborAmt = hrs * laborRate
    const jobParts = partLines.filter((p: any) => p.related_labor_line_id === job.id)
    const partsAmt = jobParts.reduce((s: number, p: any) => s + ((p.parts_sell_price || p.unit_price || 0) * (p.quantity || 1)), 0)
    totalLabor += laborAmt
    totalParts += partsAmt

    // Job header — always start on a page with enough room
    need(50)
    hr(y, accent); y -= 6

    txt(`Job ${i + 1}:`, L, y, 9, true, accent)
    const jobDesc = (job.description || '').substring(0, 45)
    txt(jobDesc, L + 44, y, 9, true)
    y -= 18

    // Labor line
    need(LINE_H * 2)
    txt('Labor', L + 4, y, 7, true, light)
    txt('Hours', 350, y, 7, true, light)
    txt('Rate', 420, y, 7, true, light)
    txt('Amount', R - 42, y, 7, true, light)
    y -= 5
    hr(y, rule)
    y -= 14

    txt(jobDesc, L + 4, y, 9)
    txt(String(hrs), 355, y, 9)
    txt(fmt(laborRate) + '/hr', 415, y, 8, false, mid)
    txt(fmt(laborAmt), R - 42, y, 9, true)
    y -= 18

    // Parts for this job
    if (jobParts.length > 0) {
      need(LINE_H * 2)
      txt('Qty', L + 4, y, 7, true, light)
      txt('Part', L + 34, y, 7, true, light)
      txt('Part #', 280, y, 7, true, light)
      txt('Price', 420, y, 7, true, light)
      txt('Amount', R - 42, y, 7, true, light)
      y -= 5
      hr(y, rule)
      y -= 13

      for (const p of jobParts) {
        need(LINE_H)
        const sell = p.parts_sell_price || p.unit_price || 0
        const qty = p.quantity || 1
        txt(String(qty), L + 10, y, 8)
        txt((p.real_name || p.rough_name || p.description || '').substring(0, 35), L + 34, y, 8)
        txt((p.part_number || '').substring(0, 14), 280, y, 7, false, light)
        txt(fmt(sell), 420, y, 8)
        txt(fmt(sell * qty), R - 42, y, 8)
        y -= 14
      }
    }

    // Job recap line
    y -= 4
    need(LINE_H)
    txt(`Job Total: ${fmt(laborAmt + partsAmt)}`, R - 100, y, 8, true)
    y -= 20
  }

  // ═══════════════════════════════════════════════════════════
  //  ORPHAN PARTS
  // ═══════════════════════════════════════════════════════════

  if (orphanParts.length > 0) {
    need(50)
    hr(y, accent); y -= 6
    txt('Additional Parts', L, y, 9, true)
    y -= 18

    txt('Qty', L + 4, y, 7, true, light)
    txt('Part', L + 34, y, 7, true, light)
    txt('Part #', 280, y, 7, true, light)
    txt('Price', 420, y, 7, true, light)
    txt('Amount', R - 42, y, 7, true, light)
    y -= 5; hr(y, rule); y -= 13

    for (const p of orphanParts) {
      need(LINE_H)
      const sell = p.parts_sell_price || p.unit_price || 0
      const qty = p.quantity || 1
      totalParts += sell * qty
      txt(String(qty), L + 10, y, 8)
      txt((p.real_name || p.rough_name || p.description || '').substring(0, 35), L + 34, y, 8)
      txt((p.part_number || '').substring(0, 14), 280, y, 7, false, light)
      txt(fmt(sell), 420, y, 8)
      txt(fmt(sell * qty), R - 42, y, 8)
      y -= 14
    }
    y -= 10
  }

  // ═══════════════════════════════════════════════════════════
  //  TOTALS — from stored invoice record
  // ═══════════════════════════════════════════════════════════

  need(100)
  hr(y, accent); y -= 18
  const sx = R - 180

  txt(`Labor (${jobLines.length} ${jobLines.length === 1 ? 'job' : 'jobs'})`, sx, y, 10)
  txt(fmt(totalLabor), R - 42, y, 10, true)
  y -= 18

  txt(`Parts (${partLines.length} ${partLines.length === 1 ? 'item' : 'items'})`, sx, y, 10)
  txt(fmt(totalParts), R - 42, y, 10, true)
  y -= 18

  hr(y + 4, rule); y -= 14
  txt('Subtotal', sx, y, 10, false, mid)
  txt(fmt(inv.subtotal || (totalLabor + totalParts)), R - 42, y, 10, true)
  y -= 18

  const storedTax = inv.tax_amount || 0
  if (storedTax > 0) {
    txt(`Tax (${shop?.tax_rate || 0}%${shop?.tax_labor ? ' incl. labor' : ' parts only'})`, sx, y, 9, false, mid)
    txt(fmt(storedTax), R - 42, y, 9)
    y -= 18
  } else {
    txt('Tax', sx, y, 9, false, mid); txt('Exempt', R - 55, y, 9, false, light); y -= 18
  }

  hr(y + 4, accent); y -= 16
  txt('Total', sx, y, 14, true)
  txt(fmt(inv.total || (totalLabor + totalParts + storedTax)), R - 48, y, 14, true, money)
  y -= 28

  // ═══════════════════════════════════════════════════════════
  //  PAYMENT INSTRUCTIONS
  // ═══════════════════════════════════════════════════════════

  if (shop?.payment_payee_name) {
    need(80)
    hr(y, rule); y -= 16
    txt('PAYMENT INSTRUCTIONS', L, y, 9, true, accent)
    y -= 16

    txt('Payable to: ' + shop.payment_payee_name, L, y, 9, true)
    if (shop.payment_bank_name) txt('Bank: ' + shop.payment_bank_name, 300, y, 8, false, mid)
    y -= 18

    if (shop.payment_ach_account) {
      need(LINE_H)
      txt('ACH', L, y, 7, true, light)
      txt('Account: ' + shop.payment_ach_account + (shop.payment_ach_routing ? '   Routing: ' + shop.payment_ach_routing : ''), L + 32, y, 8)
      y -= 14
    }
    if (shop.payment_wire_account) {
      need(LINE_H)
      txt('Wire', L, y, 7, true, light)
      txt('Account: ' + shop.payment_wire_account + (shop.payment_wire_routing ? '   Routing: ' + shop.payment_wire_routing : ''), L + 32, y, 8)
      y -= 14
    }
    if (shop.payment_zelle_email_1) {
      need(LINE_H)
      txt('Zelle', L, y, 7, true, light)
      txt(shop.payment_zelle_email_1 + (shop.payment_zelle_email_2 ? '  /  ' + shop.payment_zelle_email_2 : ''), L + 32, y, 8)
      y -= 14
    }
    if (shop.payment_mail_payee) {
      need(LINE_H)
      txt('Mail', L, y, 7, true, light)
      txt(shop.payment_mail_payee + ', ' + [shop.payment_mail_address, shop.payment_mail_city, shop.payment_mail_state, shop.payment_mail_zip].filter(Boolean).join(', '), L + 32, y, 8)
      y -= 14
    }

    y -= 8
    need(LINE_H)
    txt(`Please reference invoice #${inv.invoice_number || ''} with your payment.  Also accepted: Cash, Check, Credit/Debit Card.`, L, y, 7, false, light)
  }

  // Footer on last page
  drawFooter()

  const pdfBytes = await pdf.save()
  return { pdfBytes, filename: `Invoice-${inv.invoice_number || invoiceId}.pdf` }
}
