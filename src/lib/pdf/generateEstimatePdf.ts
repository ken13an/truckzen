import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// CANONICAL ESTIMATE PDF GENERATOR — SNAPSHOT-TRUTH ONLY
//
// This generator reads ONLY:
//   - estimates (header / status / totals)
//   - estimate_lines (per-line snapshot rows)
//   - service_orders + assets + customers (header / vehicle / bill-to)
//   - shops (shop info / tax label)
//
// No live work-order math, no invoice-calc reducers, no pricing
// invention. If the snapshot is missing/incomplete this returns null —
// the caller (send route or printable route) must surface that to the
// user. Snapshot rows must be created/validated upstream by
// ensureEstimateSnapshot + validateEstimateSnapshot from
// '@/lib/estimates/snapshotEnsure'.

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  try { const dt = new Date(d); return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}` }
  catch { return d || '' }
}

function sanitizeFilename(s: string): string {
  return (s || 'estimate').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
}

function fmtMoney(n: number): string {
  return '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export async function generateEstimatePdf(estimateId: string): Promise<{ pdfBytes: Uint8Array; filename: string } | null> {
  try {
    const supabase = db()

    const { data: est } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .single()
    if (!est) {
      console.warn('[estimate-pdf] estimate not found', { estimateId })
      return null
    }

    const { data: estLinesRaw } = await supabase
      .from('estimate_lines')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('line_number', { ascending: true, nullsFirst: false })
    const estLines: any[] = estLinesRaw || []

    if (estLines.length === 0) {
      console.warn('[estimate-pdf] snapshot missing — refusing to generate', { estimateId })
      return null
    }

    const soId = (est as any).repair_order_id || (est as any).wo_id
    let so: any = null
    let asset: any = null
    let cust: any = null
    if (soId) {
      const { data: soRow } = await supabase
        .from('service_orders')
        .select('so_number, complaint, cause, correction, mileage_at_service, assets(unit_number, year, make, model, odometer, vin), customers(company_name, contact_name, phone, email, address)')
        .eq('id', soId).single()
      so = soRow
      asset = soRow?.assets || null
      cust = soRow?.customers || null
    }

    const { data: shop } = await supabase
      .from('shops')
      .select('name, dba, phone, email, address, city, state, zip, tax_rate, tax_labor')
      .eq('id', (est as any).shop_id).single()

    // Snapshot totals — pulled directly from the estimates row. These were
    // written by ensureEstimateSnapshot (same formula as create_from_wo).
    const laborTotal = Number((est as any).labor_total) || 0
    const partsTotal = Number((est as any).parts_total) || 0
    const subtotal = Number((est as any).subtotal) || (laborTotal + partsTotal)
    const taxAmount = Number((est as any).tax_amount) || 0
    const grandTotal = Number((est as any).grand_total) || Number((est as any).total) || (subtotal + taxAmount)
    const taxRate = Number((est as any).tax_rate ?? shop?.tax_rate) || 0
    const taxLabor = shop?.tax_labor === true

    // Split snapshot rows by line_type. Both create_from_wo (thin) and
    // PATCH (full) shapes resolve to the same display fields below.
    const laborRows = estLines.filter((l) => l.line_type === 'labor')
    const partRows = estLines.filter((l) => l.line_type === 'part')

    const estimateNumber = (est as any).estimate_number || ''
    const status = (est as any).status || 'draft'
    const approvalToken = (est as any).approval_token || ''
    const portalLink = approvalToken ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/estimate/${approvalToken}` : ''

    const pdf = await PDFDocument.create()
    let page = pdf.addPage([612, 792])
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

    const dark = rgb(0.12, 0.14, 0.17)
    const mid = rgb(0.35, 0.38, 0.42)
    const light = rgb(0.6, 0.63, 0.67)
    const rule = rgb(0.85, 0.87, 0.89)
    const accent = rgb(0.11, 0.44, 0.91)
    const headerStripBg = rgb(0.96, 0.97, 0.98)
    const boxBorder = rgb(0.88, 0.90, 0.92)
    const money = rgb(0.06, 0.52, 0.30)

    const L = 50
    const R = 562
    const W = R - L
    const BOTTOM = 65
    let y = 760

    const shopName = shop?.dba || shop?.name || 'TruckZen'

    function drawFooter() {
      page.drawLine({ start: { x: L, y: 38 }, end: { x: R, y: 38 }, thickness: 0.3, color: rule })
      const footerText = `${shopName}  |  ${shop?.phone || ''}  |  ${shop?.email || ''}`.replace(/[\r\n\t]+/g, ' ')
      page.drawText(footerText, { x: L, y: 28, size: 7, font, color: light })
      const pwr = 'Powered by TruckZen'
      page.drawText(pwr, { x: R - font.widthOfTextAtSize(pwr, 6), y: 28, size: 6, font, color: light })
    }
    function newPage() { drawFooter(); page = pdf.addPage([612, 792]); y = 760 }
    function need(h: number) { if (y - h < BOTTOM) newPage() }
    function clean(t: string): string {
      return (t || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
    }
    function txt(t: string, x: number, yPos: number, size = 9, bold = false, color = dark) {
      page.drawText(clean(t), { x, y: yPos, size, font: bold ? fontBold : font, color })
    }
    function txtRight(t: string, xRight: number, yPos: number, size = 9, bold = false, color = dark) {
      const s = clean(t)
      const f = bold ? fontBold : font
      page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y: yPos, size, font: f, color })
    }
    function txtCenter(t: string, xCenter: number, yPos: number, size = 9, bold = false, color = dark) {
      const s = clean(t)
      const f = bold ? fontBold : font
      page.drawText(s, { x: xCenter - f.widthOfTextAtSize(s, size) / 2, y: yPos, size, font: f, color })
    }
    function rect(x: number, yPos: number, w: number, h: number, color: typeof accent) {
      page.drawRectangle({ x, y: yPos, width: w, height: h, color })
    }
    function box(x: number, yPos: number, w: number, h: number) {
      page.drawRectangle({ x, y: yPos, width: w, height: h, borderColor: boxBorder, borderWidth: 0.6 })
    }
    function wrap(t: string, x: number, maxW: number, size: number, bold: boolean, color: typeof dark) {
      const f = bold ? fontBold : font
      const words = clean(t).split(' ')
      let ln = ''
      for (const word of words) {
        const test = ln ? ln + ' ' + word : word
        if (f.widthOfTextAtSize(test, size) > maxW && ln) {
          need(size + 4); txt(ln, x, y, size, bold, color); y -= size + 3; ln = word
        } else { ln = test }
      }
      if (ln) { need(size + 4); txt(ln, x, y, size, bold, color); y -= size + 3 }
    }

    // ── HEADER (blue band) ──────────────────────────────────────────────
    rect(L, 730, W, 32, accent)
    page.drawText(shopName, { x: L + 14, y: 740, size: 16, font: fontBold, color: rgb(1, 1, 1) })
    const titleStr = 'ESTIMATE'
    page.drawText(titleStr, { x: R - fontBold.widthOfTextAtSize(titleStr, 18) - 14, y: 740, size: 18, font: fontBold, color: rgb(1, 1, 1) })
    y = 718

    // Shop contact strip
    if (shop?.address) { txt(shop.address, L, y, 8, false, mid); y -= 11 }
    const cityZip = [shop?.city, shop?.state, shop?.zip].filter(Boolean).join(', ')
    if (cityZip) { txt(cityZip, L, y, 8, false, mid); y -= 11 }
    if (shop?.phone) { txt(shop.phone, L, y, 8, false, mid); y -= 11 }
    if (shop?.email) { txt(shop.email, L, y, 8, false, mid); y -= 11 }

    // Right meta block
    let ry = 718
    const metaX = 400
    const metaLabelW = 70
    const metaPairs: [string, string][] = [
      ['Estimate #', estimateNumber || '—'],
      ['Date', fmtDate((est as any).sent_at || (est as any).created_at) || '—'],
      ['Valid Until', fmtDate((est as any).valid_until) || '—'],
      ['Status', String(status).replace(/_/g, ' ').toUpperCase()],
      ['WO #', so?.so_number || '—'],
    ]
    if (asset?.unit_number) metaPairs.push(['Unit #', String(asset.unit_number)])
    for (const [label, val] of metaPairs) {
      txt(label, metaX, ry, 8, true, light)
      txt(val, metaX + metaLabelW, ry, 8, true, dark)
      ry -= 12
    }
    y = Math.min(y, ry) - 14

    // ── BILL TO + VEHICLE (bordered boxes) ──────────────────────────────
    const cardH = 88
    const cardGap = 12
    const cardW = (W - cardGap) / 2
    const cardTop = y
    const cardBottom = cardTop - cardH
    box(L, cardBottom, cardW, cardH)
    box(L + cardW + cardGap, cardBottom, cardW, cardH)

    // BILL TO content
    let by = cardTop - 14
    txt('BILL TO', L + 10, by, 8, true, light); by -= 14
    if (cust?.company_name) { txt(cust.company_name, L + 10, by, 11, true); by -= 13 }
    if (cust?.contact_name && cust.contact_name !== cust.company_name) { txt(cust.contact_name, L + 10, by, 9, false, mid); by -= 11 }
    if (cust?.phone) { txt(cust.phone, L + 10, by, 9, false, mid); by -= 11 }
    if (cust?.email) { txt(cust.email, L + 10, by, 9, false, mid); by -= 11 }

    // VEHICLE content
    const vx = L + cardW + cardGap + 10
    let vy = cardTop - 14
    txt('VEHICLE', vx, vy, 8, true, light); vy -= 14
    if (asset?.unit_number) { txt('#' + asset.unit_number, vx, vy, 11, true); vy -= 13 }
    const vehLine = [asset?.year, asset?.make, asset?.model].filter(Boolean).join(' ')
    if (vehLine) { txt(vehLine, vx, vy, 9, false, dark); vy -= 11 }
    if (asset?.vin) { txt('VIN: ' + asset.vin, vx, vy, 8, false, light); vy -= 11 }
    const mi = (so as any)?.mileage_at_service || asset?.odometer
    if (mi) { txt('Mileage: ' + Number(mi).toLocaleString(), vx, vy, 9, false, mid); vy -= 11 }

    y = cardBottom - 14

    // ── CONCERN ─────────────────────────────────────────────────────────
    if ((so as any)?.complaint || (so as any)?.cause || (so as any)?.correction) {
      need(40)
      txt('CONCERN', L, y, 8, true, light); y -= 13
      if ((so as any).complaint) { wrap((so as any).complaint, L, W, 10, false, dark) }
      if ((so as any).cause) { y -= 4; txt('Cause:', L, y, 8, true, mid); y -= 11; wrap((so as any).cause, L + 8, W - 16, 9, false, dark) }
      if ((so as any).correction) { y -= 4; txt('Correction:', L, y, 8, true, mid); y -= 11; wrap((so as any).correction, L + 8, W - 16, 9, false, dark) }
      y -= 8
    }

    // ── LABOR TABLE ────────────────────────────────────────────────────
    if (laborRows.length > 0) {
      need(40)
      txt('LABOR', L, y, 9, true, accent); y -= 14

      // Light header strip
      rect(L, y - 2, W, 16, headerStripBg)
      box(L, y - 2, W, 16)
      txt('DESCRIPTION', L + 10, y + 4, 8, true, mid)
      txt('HOURS', 360, y + 4, 8, true, mid)
      txt('RATE', 425, y + 4, 8, true, mid)
      txtRight('TOTAL', R - 10, y + 4, 8, true, mid)
      y -= 18

      for (const l of laborRows) {
        need(18)
        // Both shapes:
        //   - create_from_wo: quantity=hrs, unit_price=rate, total=line total
        //   - PATCH: labor_hours, labor_rate, labor_total / line_total / total
        const hrs = Number((l as any).labor_hours) || Number((l as any).quantity) || 0
        const rate = Number((l as any).labor_rate) || Number((l as any).unit_price) || 0
        const amt = Number((l as any).labor_total) || Number((l as any).line_total) || Number((l as any).total) || (hrs * rate)
        const desc = (l as any).description || '—'
        const descX = L + 10
        const descMax = 360 - descX - 6
        if (font.widthOfTextAtSize(desc, 9) > descMax) {
          const rowTop = y
          txt(hrs ? String(hrs) : '—', 360, rowTop, 9)
          txt(rate ? fmtMoney(rate) : '—', 425, rowTop, 9)
          txtRight(fmtMoney(amt), R - 10, rowTop, 9, true)
          wrap(desc, descX, descMax, 9, false, dark)
          y -= 4
        } else {
          txt(desc, descX, y, 9)
          txt(hrs ? String(hrs) : '—', 360, y, 9)
          txt(rate ? fmtMoney(rate) : '—', 425, y, 9)
          txtRight(fmtMoney(amt), R - 10, y, 9, true)
          y -= 14
        }
      }
      y -= 8
    }

    // ── PARTS TABLE ────────────────────────────────────────────────────
    if (partRows.length > 0) {
      need(40)
      txt('PARTS', L, y, 9, true, accent); y -= 14

      rect(L, y - 2, W, 16, headerStripBg)
      box(L, y - 2, W, 16)
      txt('PART', L + 10, y + 4, 8, true, mid)
      txt('QTY', 380, y + 4, 8, true, mid)
      txt('PRICE', 430, y + 4, 8, true, mid)
      txtRight('TOTAL', R - 10, y + 4, 8, true, mid)
      y -= 18

      for (const p of partRows) {
        need(18)
        const qty = Number((p as any).quantity || 1)
        const price = Number((p as any).unit_price) || 0
        const amt = Number((p as any).parts_total) || Number((p as any).line_total) || Number((p as any).total) || (qty * price)
        const desc = (p as any).description || '—'
        const pn = (p as any).part_number ? ` · Part # ${(p as any).part_number}` : ''
        const fullDesc = clean(desc + pn)
        const descX = L + 10
        const descMax = 380 - descX - 6
        if (font.widthOfTextAtSize(fullDesc, 9) > descMax) {
          const rowTop = y
          txtCenter(String(qty), 388, rowTop, 9)
          txt(fmtMoney(price), 430, rowTop, 9)
          txtRight(fmtMoney(amt), R - 10, rowTop, 9, true)
          wrap(fullDesc, descX, descMax, 9, false, dark)
          y -= 4
        } else {
          txt(fullDesc, descX, y, 9)
          txtCenter(String(qty), 388, y, 9)
          txt(fmtMoney(price), 430, y, 9)
          txtRight(fmtMoney(amt), R - 10, y, 9, true)
          y -= 14
        }
      }
      y -= 8
    }

    // ── SUMMARY BOX (bordered, right-aligned) ───────────────────────────
    need(140)
    const sumW = 280
    const sumX = R - sumW
    const sumTop = y
    const sumLines = 4 + (taxAmount > 0 ? 1 : 1) + 1 // labor, parts, subtotal, tax, estimate-total header
    const sumH = 18 + (sumLines * 18) + 14
    const sumBottom = sumTop - sumH
    box(sumX, sumBottom, sumW, sumH)

    let sy = sumTop - 16
    txt('SUMMARY', sumX + 14, sy, 9, true, mid); sy -= 16
    page.drawLine({ start: { x: sumX + 14, y: sy + 8 }, end: { x: sumX + sumW - 14, y: sy + 8 }, thickness: 0.5, color: rule })
    txt('Labor total', sumX + 14, sy, 10, false, dark); txtRight(fmtMoney(laborTotal), sumX + sumW - 14, sy, 10, true); sy -= 16
    txt('Parts total', sumX + 14, sy, 10, false, dark); txtRight(fmtMoney(partsTotal), sumX + sumW - 14, sy, 10, true); sy -= 16
    txt('Subtotal', sumX + 14, sy, 10, false, mid); txtRight(fmtMoney(subtotal), sumX + sumW - 14, sy, 10, true); sy -= 16
    if (taxAmount > 0) {
      const taxLabel = `Tax (${taxRate}%${taxLabor ? ' incl. labor' : ' parts only'})`
      txt(taxLabel, sumX + 14, sy, 9, false, mid); txtRight(fmtMoney(taxAmount), sumX + sumW - 14, sy, 9); sy -= 16
    } else {
      txt('Tax', sumX + 14, sy, 9, false, mid); txtRight('Exempt', sumX + sumW - 14, sy, 9, false, mid); sy -= 16
    }
    page.drawLine({ start: { x: sumX + 14, y: sy + 8 }, end: { x: sumX + sumW - 14, y: sy + 8 }, thickness: 1, color: accent })
    txt('ESTIMATE TOTAL', sumX + 14, sy - 4, 11, true)
    txtRight(fmtMoney(grandTotal), sumX + sumW - 14, sy - 4, 16, true, money)

    y = sumBottom - 16

    // ── APPROVAL ────────────────────────────────────────────────────────
    need(120)
    txt('APPROVAL', L, y, 9, true, accent); y -= 14
    wrap('Review and approve this estimate using the customer portal link. This estimate covers the listed labor and parts only. Any additional work will require separate approval.', L, W, 9, false, dark)
    y -= 6
    if (portalLink) {
      const btnY = y - 26
      rect(L, btnY, 220, 28, accent)
      const btnText = 'REVIEW & APPROVE ESTIMATE'
      page.drawText(btnText, { x: L + (220 - fontBold.widthOfTextAtSize(btnText, 9)) / 2, y: btnY + 10, size: 9, font: fontBold, color: rgb(1, 1, 1) })
      txt('Portal:', L + 230, btnY + 16, 8, true, light)
      // Trim very long portal links to keep them on one line
      const portalShown = portalLink.length > 60 ? portalLink.slice(0, 57) + '...' : portalLink
      txt(portalShown, L + 230, btnY + 4, 8, false, accent)
      y = btnY - 14
    }

    drawFooter()

    const pdfBytes = await pdf.save()
    const filename = sanitizeFilename(`Estimate-${estimateNumber || estimateId}.pdf`)
    return { pdfBytes, filename }
  } catch (err: any) {
    console.error('[estimate-pdf] generation failed', { estimateId, error: err?.message || String(err) })
    return null
  }
}
