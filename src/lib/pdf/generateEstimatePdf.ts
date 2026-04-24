import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { isNonBillablePartRequirementRow, isCustomerSuppliedPartRow, isNoPartNeededPartRow } from '@/lib/parts-status'
import { calcInvoiceTotals } from '@/lib/invoice-calc'

// CANONICAL ESTIMATE PDF GENERATOR
// All estimate PDF surfaces (email attachment, printable route) MUST go through
// this single function. Do NOT re-implement estimate math or layout in the
// route files. Totals come from calcInvoiceTotals (same reducer the
// EstimateTab screen uses); line-item rows come from so_lines filtered to
// !is_additional (Estimate 1 / original-scope rows).

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
    if (!est) return null

    const soId = (est as any).repair_order_id || (est as any).wo_id
    if (!soId) {
      console.warn('[estimate-pdf] estimate has no linked WO', { estimateId })
      return null
    }

    const { data: so } = await supabase
      .from('service_orders')
      .select('so_number, complaint, cause, correction, mileage_at_service, created_at, ownership_type, assets(unit_number, year, make, model, odometer, vin), customers(company_name, contact_name, phone, email, address)')
      .eq('id', soId).single()

    const { data: shop } = await supabase
      .from('shops')
      .select('name, dba, phone, email, address, city, state, zip, labor_rate, default_labor_rate, tax_rate, tax_labor')
      .eq('id', (est as any).shop_id).single()

    // Live so_lines — same source the EstimateTab screen reads from. Filter to
    // !is_additional so this PDF reflects Estimate 1 (the original customer
    // estimate). Supplements are out of scope for the estimate PDF.
    const { data: allLines } = await supabase
      .from('so_lines')
      .select('id, line_type, description, real_name, rough_name, part_number, quantity, unit_price, parts_sell_price, billed_hours, estimated_hours, actual_hours, parts_status, line_status, parts_requirement, parts_requirement_note, is_additional')
      .eq('so_id', soId)

    const estimateOneLines = (allLines || []).filter((l: any) => l.is_additional !== true)

    // Resolve labor rate the same way the screen does — ownership-typed
    // shop_labor_rates first, then shop default. Mirrors page.tsx:815-818.
    const ownership = (so?.assets as any)?.ownership_type || (so as any)?.ownership_type || 'outside_customer'
    const { data: ownershipRate } = await supabase
      .from('shop_labor_rates')
      .select('rate_per_hour')
      .eq('shop_id', (est as any).shop_id)
      .eq('ownership_type', ownership)
      .maybeSingle()
    const laborRate = Number(ownershipRate?.rate_per_hour || shop?.labor_rate || shop?.default_labor_rate || 0)
    const taxRate = Number(shop?.tax_rate) || 0
    const taxLabor = shop?.tax_labor === true

    // Canonical totals — calcInvoiceTotals is the same reducer used by the
    // WO Invoice tab and accounting/approve. Single source of truth.
    const totals = calcInvoiceTotals(estimateOneLines, laborRate, taxRate, taxLabor)

    // Display rows
    const laborRows = estimateOneLines
      .filter((l: any) => l.line_type === 'labor' && l.parts_status !== 'canceled' && l.line_status !== 'canceled')
    const partRowsAll = estimateOneLines
      .filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled')
    const partRowsBillable = partRowsAll.filter((p: any) => !isNonBillablePartRequirementRow(p))
    const partRowsNonBillable = partRowsAll.filter((p: any) => isNonBillablePartRequirementRow(p))

    const estimateNumber = (est as any).estimate_number || ''
    const status = (est as any).status || 'draft'
    const approvalToken = (est as any).approval_token || ''
    const portalLink = approvalToken ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/estimate/${approvalToken}` : ''

    const asset = (so?.assets as any) || {}
    const cust = (so?.customers as any) || {}

    const pdf = await PDFDocument.create()
    let page = pdf.addPage([612, 792])
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

    const dark = rgb(0.12, 0.14, 0.17)
    const mid = rgb(0.35, 0.38, 0.42)
    const light = rgb(0.6, 0.63, 0.67)
    const rule = rgb(0.85, 0.87, 0.89)
    const accent = rgb(0.11, 0.44, 0.91)
    const accentSoft = rgb(0.93, 0.96, 1.0)
    const money = rgb(0.06, 0.52, 0.30)

    const L = 50
    const R = 562
    const W = R - L
    const BOTTOM = 65
    let y = 750

    const shopName = shop?.dba || shop?.name || 'TruckZen'

    function drawFooter() {
      page.drawLine({ start: { x: L, y: 38 }, end: { x: R, y: 38 }, thickness: 0.3, color: rule })
      const footerText = `${shopName}  |  ${shop?.phone || ''}  |  ${shop?.email || ''}`.replace(/[\r\n\t]+/g, ' ')
      page.drawText(footerText, { x: L, y: 28, size: 7, font, color: light })
      const pwr = 'Powered by TruckZen'
      page.drawText(pwr, { x: R - font.widthOfTextAtSize(pwr, 6), y: 28, size: 6, font, color: light })
    }
    function newPage() { drawFooter(); page = pdf.addPage([612, 792]); y = 750 }
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
    function hr(yPos: number, color = rule, thickness = 0.5) {
      page.drawLine({ start: { x: L, y: yPos }, end: { x: R, y: yPos }, thickness, color })
    }
    function rect(x: number, yPos: number, w: number, h: number, color: typeof accent) {
      page.drawRectangle({ x, y: yPos, width: w, height: h, color })
    }
    function wrap(t: string, x: number, maxW: number, size: number, bold: boolean, color: typeof dark): number {
      const f = bold ? fontBold : font
      const words = clean(t).split(' ')
      let ln = ''
      let lines = 0
      for (const word of words) {
        const test = ln ? ln + ' ' + word : word
        if (f.widthOfTextAtSize(test, size) > maxW && ln) {
          need(size + 4); txt(ln, x, y, size, bold, color); y -= size + 3; ln = word; lines++
        } else { ln = test }
      }
      if (ln) { need(size + 4); txt(ln, x, y, size, bold, color); y -= size + 3; lines++ }
      return lines
    }

    // ── HEADER (blue band) ──────────────────────────────────────────────
    rect(L, 720, W, 30, accent)
    page.drawText(shopName, { x: L + 12, y: 730, size: 14, font: fontBold, color: rgb(1, 1, 1) })
    const titleStr = 'ESTIMATE'
    page.drawText(titleStr, { x: R - fontBold.widthOfTextAtSize(titleStr, 16) - 12, y: 730, size: 16, font: fontBold, color: rgb(1, 1, 1) })
    y = 705

    // Shop contact strip
    const shopAddr = [shop?.address, [shop?.city, shop?.state, shop?.zip].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
    if (shopAddr) { txt(shopAddr, L, y, 8, false, mid); y -= 11 }
    const shopContact = [shop?.phone, shop?.email].filter(Boolean).join(' · ')
    if (shopContact) { txt(shopContact, L, y, 8, false, mid); y -= 11 }

    // Right-side meta block (Estimate #, date, valid until, status, WO #)
    let ry = 705
    const metaX = 400
    const metaLabelW = 75
    const metaPairs: [string, string][] = [
      ['Estimate #', estimateNumber || '—'],
      ['Date', fmtDate((est as any).sent_at || (est as any).created_at) || '—'],
      ['Valid Until', fmtDate((est as any).valid_until) || '—'],
      ['Status', String(status).toUpperCase()],
      ['WO #', so?.so_number || '—'],
    ]
    for (const [label, val] of metaPairs) {
      txt(label, metaX, ry, 8, true, light)
      txt(val, metaX + metaLabelW, ry, 8, false, dark)
      ry -= 12
    }
    y = Math.min(y, ry) - 12
    hr(y, rule); y -= 14

    // ── BILL TO + VEHICLE (two columns) ─────────────────────────────────
    need(80)
    const colTop = y
    let ly = colTop
    txt('BILL TO', L, ly, 8, true, light); ly -= 13
    if (cust?.company_name) { txt(cust.company_name, L, ly, 11, true); ly -= 13 }
    if (cust?.contact_name && cust.contact_name !== cust.company_name) { txt(cust.contact_name, L, ly, 9, false, mid); ly -= 11 }
    if (cust?.phone) { txt(cust.phone, L, ly, 9, false, mid); ly -= 11 }
    if (cust?.email) { txt(cust.email, L, ly, 9, false, mid); ly -= 11 }
    if (cust?.address) { txt(cust.address, L, ly, 9, false, mid); ly -= 11 }

    let vy = colTop
    const vehX = 320
    txt('VEHICLE', vehX, vy, 8, true, light); vy -= 13
    if (asset?.unit_number) { txt('#' + asset.unit_number, vehX, vy, 11, true); vy -= 13 }
    const vehLine = [asset?.year, asset?.make, asset?.model].filter(Boolean).join(' ')
    if (vehLine) { txt(vehLine, vehX, vy, 9, false, dark); vy -= 11 }
    if (asset?.vin) { txt('VIN: ' + asset.vin, vehX, vy, 8, false, light); vy -= 11 }
    const mi = (so as any)?.mileage_at_service || asset?.odometer
    if (mi) { txt('Mileage: ' + Number(mi).toLocaleString(), vehX, vy, 9, false, mid); vy -= 11 }
    y = Math.min(ly, vy) - 14

    // ── COMPLAINT / CAUSE / CORRECTION ──────────────────────────────────
    if ((so as any)?.complaint || (so as any)?.cause || (so as any)?.correction) {
      need(30)
      hr(y, rule); y -= 12
      txt('CONCERN', L, y, 8, true, light); y -= 12
      if ((so as any).complaint) {
        txt('Complaint:', L, y, 8, true, mid); y -= 11
        wrap((so as any).complaint, L + 8, W - 16, 9, false, dark); y -= 4
      }
      if ((so as any).cause) {
        txt('Cause:', L, y, 8, true, mid); y -= 11
        wrap((so as any).cause, L + 8, W - 16, 9, false, dark); y -= 4
      }
      if ((so as any).correction) {
        txt('Correction:', L, y, 8, true, mid); y -= 11
        wrap((so as any).correction, L + 8, W - 16, 9, false, dark); y -= 4
      }
      y -= 4
    }

    // ── LABOR TABLE ────────────────────────────────────────────────────
    if (laborRows.length > 0) {
      need(40)
      hr(y, accent, 1); y -= 14
      txt('LABOR', L, y, 9, true, accent); y -= 14

      // header row (light gray strip)
      rect(L, y - 2, W, 16, accentSoft)
      txt('Description', L + 8, y + 4, 8, true, mid)
      txt('Hours', 360, y + 4, 8, true, mid)
      txt('Rate', 425, y + 4, 8, true, mid)
      txtRight('Amount', R - 8, y + 4, 8, true, mid)
      y -= 18

      let laborSum = 0
      for (const l of laborRows) {
        need(18)
        const hrs = Number((l as any).billed_hours || (l as any).estimated_hours || (l as any).actual_hours || 0)
        const amt = hrs * laborRate
        const desc = (l as any).description || '—'
        // description may be long; wrap
        const descX = L + 8
        const descMax = 360 - descX - 6
        if (font.widthOfTextAtSize(desc, 9) > descMax) {
          const rowTop = y
          txt(String(hrs || '—'), 360, rowTop, 9)
          txt(fmtMoney(laborRate) + '/hr', 425, rowTop, 9)
          txtRight(fmtMoney(amt), R - 8, rowTop, 9, true)
          wrap(desc, descX, descMax, 9, false, dark)
          y -= 4
        } else {
          txt(desc, descX, y, 9)
          txt(String(hrs || '—'), 360, y, 9)
          txt(fmtMoney(laborRate) + '/hr', 425, y, 9)
          txtRight(fmtMoney(amt), R - 8, y, 9, true)
          y -= 14
        }
        laborSum += amt
      }

      // labor subtotal
      hr(y + 2, rule); y -= 14
      txt('Labor Total', 425, y, 9, true, mid)
      txtRight(fmtMoney(laborSum), R - 8, y, 10, true)
      y -= 18
    }

    // ── PARTS TABLE ────────────────────────────────────────────────────
    if (partRowsBillable.length > 0) {
      need(40)
      hr(y, accent, 1); y -= 14
      txt('PARTS', L, y, 9, true, accent); y -= 14

      rect(L, y - 2, W, 16, accentSoft)
      txt('Qty', L + 8, y + 4, 8, true, mid)
      txt('Description', 90, y + 4, 8, true, mid)
      txt('Part #', 360, y + 4, 8, true, mid)
      txt('Sell', 445, y + 4, 8, true, mid)
      txtRight('Amount', R - 8, y + 4, 8, true, mid)
      y -= 18

      let partsSum = 0
      for (const p of partRowsBillable) {
        need(18)
        const qty = Number((p as any).quantity || 1)
        const sell = Number((p as any).parts_sell_price || (p as any).unit_price || 0)
        const amt = qty * sell
        const name = (p as any).real_name || (p as any).rough_name || (p as any).description || '—'
        const pn = (p as any).part_number || '—'

        const descX = 90
        const descMax = 360 - descX - 6
        if (font.widthOfTextAtSize(name, 9) > descMax) {
          const rowTop = y
          txtCenter(String(qty), L + 20, rowTop, 9)
          txt(pn, 360, rowTop, 9, false, mid)
          txt(fmtMoney(sell), 445, rowTop, 9)
          txtRight(fmtMoney(amt), R - 8, rowTop, 9, true)
          wrap(name, descX, descMax, 9, false, dark)
          y -= 4
        } else {
          txtCenter(String(qty), L + 20, y, 9)
          txt(name, descX, y, 9)
          txt(pn, 360, y, 9, false, mid)
          txt(fmtMoney(sell), 445, y, 9)
          txtRight(fmtMoney(amt), R - 8, y, 9, true)
          y -= 14
        }
        partsSum += amt
      }

      hr(y + 2, rule); y -= 14
      txt('Parts Total', 425, y, 9, true, mid)
      txtRight(fmtMoney(partsSum), R - 8, y, 10, true)
      y -= 18
    }

    // ── NON-BILLABLE PLACEHOLDERS ──────────────────────────────────────
    if (partRowsNonBillable.length > 0) {
      need(30 + partRowsNonBillable.length * 12)
      hr(y, rule); y -= 12
      txt('NON-BILLABLE PLACEHOLDERS', L, y, 8, true, light); y -= 12
      for (const p of partRowsNonBillable) {
        const label = isCustomerSuppliedPartRow(p as any)
          ? 'Customer supplied'
          : isNoPartNeededPartRow(p as any) ? 'No part needed' : 'Non-billable'
        const name = (p as any).real_name || (p as any).rough_name || (p as any).description || '—'
        txt(`• ${label}: ${name} — no part charge`, L + 6, y, 8, false, mid); y -= 11
      }
      y -= 4
    }

    // ── SUMMARY BOX ────────────────────────────────────────────────────
    need(110)
    hr(y, accent, 1); y -= 16
    const sumX = R - 200
    txt('Labor', sumX, y, 10, false, mid); txtRight(fmtMoney(totals.laborTotal), R - 8, y, 10, true); y -= 16
    txt('Parts', sumX, y, 10, false, mid); txtRight(fmtMoney(totals.partsTotal), R - 8, y, 10, true); y -= 16
    if (totals.chargesTotal > 0) {
      txt('Shop Charges', sumX, y, 10, false, mid); txtRight(fmtMoney(totals.chargesTotal), R - 8, y, 10, true); y -= 16
    }
    page.drawLine({ start: { x: sumX, y: y + 6 }, end: { x: R - 8, y: y + 6 }, thickness: 0.5, color: rule })
    txt('Subtotal', sumX, y, 10, true); txtRight(fmtMoney(totals.subtotal), R - 8, y, 10, true); y -= 16
    if (totals.taxAmount > 0) {
      const taxLabel = `Tax (${taxRate}%${taxLabor ? ' incl. labor' : ' parts only'})`
      txt(taxLabel, sumX, y, 9, false, mid); txtRight(fmtMoney(totals.taxAmount), R - 8, y, 9); y -= 16
    } else {
      txt('Tax', sumX, y, 9, false, mid); txtRight('Exempt', R - 8, y, 9, false, mid); y -= 16
    }
    page.drawLine({ start: { x: sumX, y: y + 6 }, end: { x: R - 8, y: y + 6 }, thickness: 1, color: accent })
    txt('TOTAL', sumX, y - 4, 13, true)
    txtRight(fmtMoney(totals.grandTotal), R - 8, y - 4, 16, true, money)
    y -= 30

    // ── APPROVAL ────────────────────────────────────────────────────────
    // Reserve enough room for the WHOLE approval block (hr + label + wrap
    // body + button) so we don't orphan the header on the previous page.
    need(120)
    hr(y, accent, 1); y -= 14
    txt('APPROVAL', L, y, 9, true, accent); y -= 14
    wrap('Click the approval link in your email or visit the portal link below to approve this estimate. Once approved, the shop is authorized to begin the listed work. Additional repairs discovered during service will be sent to you for separate approval.', L, W, 9, false, dark)
    y -= 6
    if (portalLink) {
      // Approval-button-style box
      const btnY = y - 22
      rect(L, btnY, 200, 26, accent)
      const btnText = 'Review & Approve Estimate'
      page.drawText(btnText, { x: L + (200 - fontBold.widthOfTextAtSize(btnText, 10)) / 2, y: btnY + 9, size: 10, font: fontBold, color: rgb(1, 1, 1) })
      txt('Portal:', L + 210, btnY + 14, 8, true, light)
      txt(portalLink, L + 210, btnY + 4, 8, false, accent)
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
