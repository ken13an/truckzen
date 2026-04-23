import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { isNonBillablePartRequirementRow } from '@/lib/parts-status'

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

type Row = {
  description: string
  partNumber: string | null
  quantity: number | null
  laborHours: number | null
  laborRate: number | null
  laborTotal: number | null
  partsTotal: number | null
  unitPrice: number | null
  lineTotal: number | null
}

export async function generateEstimatePdf(estimateId: string): Promise<{ pdfBytes: Uint8Array; filename: string } | null> {
  try {
    const supabase = db()

    const { data: est } = await supabase
      .from('estimates')
      .select('*, estimate_lines(*)')
      .eq('id', estimateId)
      .single()
    if (!est) return null

    const soId = (est as any).repair_order_id || (est as any).wo_id
    let so: any = null
    let asset: any = null
    let cust: any = null
    if (soId) {
      const { data: soRow } = await supabase
        .from('service_orders')
        .select('so_number, complaint, cause, correction, mileage_at_service, created_at, ownership_type, assets(unit_number, year, make, model, odometer, vin), customers(company_name, contact_name, phone, email, address)')
        .eq('id', soId).single()
      so = soRow
      asset = soRow?.assets || null
      cust = soRow?.customers || null
    }

    const { data: shop } = await supabase
      .from('shops')
      .select('name, dba, phone, email, address, city, state, zip, labor_rate, default_labor_rate, tax_rate, tax_labor')
      .eq('id', (est as any).shop_id).single()

    const estLines: any[] = (est as any).estimate_lines || []
    const status = (est as any).status || 'draft'
    const isDraft = status === 'draft'

    // Source-of-truth rule:
    // - estimate_lines present → use them (snapshot truth)
    // - empty + draft → fall back to current so_lines for preview
    // - empty + sent/approved/declined → explicit placeholder, do NOT pull current WO truth
    let rows: Row[] = []
    let placeholderMessage: string | null = null
    let fallbackUsed = false

    if (estLines.length > 0) {
      // Optional enrichment: join so_lines for part_number/quantity when estimate_lines store only the labor/parts totals
      const refIds = estLines.map(l => l.repair_order_line_id).filter(Boolean)
      const soLineMap: Record<string, any> = {}
      if (refIds.length) {
        const { data: srcLines } = await supabase
          .from('so_lines')
          .select('id, part_number, quantity, parts_sell_price, unit_price, rough_name, real_name')
          .in('id', refIds)
        for (const r of srcLines || []) soLineMap[r.id] = r
      }
      rows = estLines
        .sort((a, b) => (a.line_number || 0) - (b.line_number || 0))
        .map(l => {
          const src = l.repair_order_line_id ? soLineMap[l.repair_order_line_id] : null
          return {
            description: l.description || src?.real_name || src?.rough_name || '',
            partNumber: src?.part_number || null,
            quantity: src?.quantity ?? null,
            laborHours: Number(l.labor_hours) || null,
            laborRate: Number(l.labor_rate) || null,
            laborTotal: Number(l.labor_total) || 0,
            partsTotal: Number(l.parts_total) || 0,
            unitPrice: src?.parts_sell_price ?? src?.unit_price ?? null,
            lineTotal: Number(l.line_total) || Number(l.total) || 0,
          }
        })
    } else if (isDraft && soId) {
      console.warn('[estimate-pdf] empty estimate_lines fallback used for draft estimate', { estimateId })
      fallbackUsed = true
      const { data: src } = await supabase
        .from('so_lines')
        .select('id, line_type, description, real_name, rough_name, part_number, quantity, unit_price, parts_sell_price, billed_hours, estimated_hours, actual_hours, parts_status, is_additional')
        .eq('so_id', soId)
      const laborRate = shop?.labor_rate || shop?.default_labor_rate || 125
      for (const l of (src || [])) {
        if ((l as any).is_additional) continue
        if (l.line_type === 'labor') {
          const hrs = Number(l.billed_hours || l.estimated_hours || l.actual_hours || 0)
          const laborTotal = hrs * laborRate
          rows.push({
            description: l.description || '',
            partNumber: null,
            quantity: null,
            laborHours: hrs || null,
            laborRate,
            laborTotal,
            partsTotal: 0,
            unitPrice: null,
            lineTotal: laborTotal,
          })
        } else if (l.line_type === 'part' && l.parts_status !== 'canceled' && !isNonBillablePartRequirementRow(l)) {
          const qty = Number(l.quantity || 1)
          const sell = Number(l.parts_sell_price || l.unit_price || 0)
          const partsTotal = qty * sell
          rows.push({
            description: l.real_name || l.rough_name || l.description || '',
            partNumber: l.part_number || null,
            quantity: qty,
            laborHours: null,
            laborRate: null,
            laborTotal: 0,
            partsTotal,
            unitPrice: sell,
            lineTotal: partsTotal,
          })
        }
      }
    } else {
      console.warn('[estimate-pdf] missing snapshot for non-draft estimate', { estimateId, status })
      placeholderMessage = 'No line-item snapshot is available for this estimate. Please contact the shop for the detailed breakdown.'
    }

    const estimateNumber = (est as any).estimate_number || ''
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
    const money = rgb(0.06, 0.52, 0.30)
    const warn = rgb(0.85, 0.45, 0.05)

    let y = 750
    const L = 50
    const R = 562
    const BOTTOM = 65
    const LINE_H = 14
    const shopName = shop?.dba || shop?.name || 'TruckZen'
    const fmt = (n: number) => '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    function drawFooter() {
      page.drawLine({ start: { x: L, y: 38 }, end: { x: R, y: 38 }, thickness: 0.3, color: rule })
      const footerText = `${shopName}  |  ${shop?.phone || ''}  |  ${shop?.email || ''}`.replace(/[\r\n\t]+/g, ' ')
      page.drawText(footerText, { x: L, y: 28, size: 7, font, color: light })
      page.drawText('Powered by TruckZen', { x: R - font.widthOfTextAtSize('Powered by TruckZen', 6), y: 28, size: 6, font, color: light })
    }
    function newPage() { drawFooter(); page = pdf.addPage([612, 792]); y = 750 }
    function need(h: number) { if (y - h < BOTTOM) newPage() }
    function clean(t: string): string {
      return (t || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
    }
    function txt(t: string, x: number, yPos: number, size = 9, bold = false, color = dark) {
      page.drawText(clean(t), { x, y: yPos, size, font: bold ? fontBold : font, color })
    }
    function hr(yPos: number, color = rule) {
      page.drawLine({ start: { x: L, y: yPos }, end: { x: R, y: yPos }, thickness: 0.5, color })
    }
    function wrap(t: string, x: number, maxW: number, size: number, bold: boolean, color: typeof dark) {
      const f = bold ? fontBold : font
      const words = clean(t).split(' ')
      let ln = ''
      for (const word of words) {
        const test = ln ? ln + ' ' + word : word
        if (f.widthOfTextAtSize(test, size) > maxW && ln) {
          need(LINE_H); txt(ln, x, y, size, bold, color); y -= size + 3; ln = word
        } else { ln = test }
      }
      if (ln) { need(LINE_H); txt(ln, x, y, size, bold, color); y -= size + 3 }
    }

    // HEADER
    txt(shopName, L, y, 16, true, accent)
    txt('ESTIMATE', R - fontBold.widthOfTextAtSize('ESTIMATE', 18), y, 18, true, accent)
    y -= 22
    hr(y, accent); y -= 16

    if (shop?.address) { txt(shop.address, L, y, 8, false, mid); y -= 12 }
    const shopCity = [shop?.city, shop?.state, shop?.zip].filter(Boolean).join(', ')
    if (shopCity) { txt(shopCity, L, y, 8, false, mid); y -= 12 }
    if (shop?.phone) { txt(shop.phone, L, y, 8, false, mid); y -= 12 }
    if (shop?.email) { txt(shop.email, L, y, 8, false, mid); y -= 12 }

    // Right column meta
    let ry = y + 48
    const dets: [string, string][] = [
      ['Estimate #', estimateNumber],
      ['Date', fmtDate((est as any).sent_at || (est as any).created_at)],
      ['Valid Until', fmtDate((est as any).valid_until) || '—'],
      ['Status', String(status).toUpperCase()],
      ['WO #', so?.so_number || ''],
    ]
    if (asset?.unit_number) dets.push(['Unit #', asset.unit_number])
    for (const [label, val] of dets) {
      txt(label, 400, ry, 8, true, light); txt(val, 460, ry, 8, false, dark); ry -= 13
    }
    y = Math.min(y, ry) - 16

    // BILL TO + VEHICLE
    need(60)
    hr(y); y -= 16
    const colStart = y
    let ly = colStart
    txt('BILL TO', L, ly, 8, true, light); ly -= 14
    if (cust?.company_name) { txt(cust.company_name, L, ly, 10, true); ly -= 14 }
    if (cust?.contact_name) { txt(cust.contact_name, L, ly, 8, false, mid); ly -= 12 }
    if (cust?.phone) { txt(cust.phone, L, ly, 8, false, mid); ly -= 12 }
    if (cust?.email) { txt(cust.email, L, ly, 8, false, mid); ly -= 12 }
    if (cust?.address) { txt(cust.address, L, ly, 8, false, mid); ly -= 12 }

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

    // Complaint/Cause/Correction
    if (so?.complaint || so?.cause || so?.correction) {
      need(30); hr(y); y -= 14
      if (so?.complaint) { txt('Complaint:', L, y, 8, true, light); y -= 12; wrap(so.complaint, L + 4, R - L - 8, 8, false, mid); y -= 4 }
      if (so?.cause) { txt('Cause:', L, y, 8, true, light); y -= 12; wrap(so.cause, L + 4, R - L - 8, 8, false, mid); y -= 4 }
      if (so?.correction) { txt('Correction:', L, y, 8, true, light); y -= 12; wrap(so.correction, L + 4, R - L - 8, 8, false, mid); y -= 4 }
      y -= 6
    }

    // Fallback / placeholder notices
    if (fallbackUsed) {
      need(20); hr(y, warn); y -= 14
      txt('DRAFT PREVIEW — items below are pulled from current work order and may change before sending.', L, y, 8, true, warn); y -= 16
    }

    // LINE ITEMS
    need(40); hr(y, accent); y -= 6
    if (placeholderMessage) {
      txt('LINE ITEMS', L, y, 9, true, accent); y -= 18
      need(40)
      wrap(placeholderMessage, L, R - L, 10, false, dark)
      y -= 6
    } else if (rows.length > 0) {
      // 5-column layout: Description / Qty·Hrs / Labor / Parts / Total
      //   description area ends at ~350 so the numeric cells right-align inside
      //   fixed tab stops. Part number + unit price appear as small sublines
      //   beneath the description to avoid cramming a "Rate" column on mobile.
      const DESC_MAX = 300
      const COL_QH = 370   // center of Qty/Hrs
      const COL_LAB = 435  // right edge of Labor
      const COL_PT = 490   // right edge of Parts
      const COL_TOT = R - 42

      txt('Description', L + 4, y, 7, true, light)
      txt('Qty / Hrs', COL_QH - 22, y, 7, true, light)
      txt('Labor', COL_LAB - 22, y, 7, true, light)
      txt('Parts', COL_PT - 22, y, 7, true, light)
      txt('Total', COL_TOT - 22, y, 7, true, light)
      y -= 5; hr(y, rule); y -= 13

      let laborSum = 0
      let partsSum = 0
      for (const r of rows) {
        need(LINE_H * 2)
        const rowTop = y
        const isLabor = (r.laborTotal || 0) > 0 && (r.partsTotal || 0) === 0
        const isPart = (r.partsTotal || 0) > 0 && (r.laborTotal || 0) === 0

        // Numeric cells anchored to rowTop
        const qtyHrs = isLabor
          ? (r.laborHours != null && r.laborHours > 0 ? `${r.laborHours} hr` : '—')
          : (r.quantity != null && Number(r.quantity) > 0 ? String(r.quantity) : '—')
        txt(qtyHrs, COL_QH - font.widthOfTextAtSize(qtyHrs, 8) / 2, rowTop, 8)
        const laborCell = isLabor ? fmt(r.laborTotal || 0) : '—'
        txt(laborCell, COL_LAB - font.widthOfTextAtSize(laborCell, 8), rowTop, 8)
        const partsCell = isPart ? fmt(r.partsTotal || 0) : '—'
        txt(partsCell, COL_PT - font.widthOfTextAtSize(partsCell, 8), rowTop, 8)
        const totalCell = fmt(r.lineTotal || 0)
        txt(totalCell, COL_TOT - fontBold.widthOfTextAtSize(totalCell, 8), rowTop, 8, true)

        // Description (may wrap; advances y)
        txt(r.description || '', L + 4, rowTop, 8, false, dark)
        y = rowTop - 12
        if (r.partNumber) { txt(`Part # ${r.partNumber}`, L + 4, y, 7, false, light); y -= 10 }
        if (isPart && r.quantity != null && Number(r.quantity) > 0 && r.unitPrice != null && Number(r.unitPrice) > 0) {
          const sub = `Qty ${r.quantity} × ${fmt(r.unitPrice)}`
          txt(sub, L + 4, y, 7, false, light); y -= 10
        }
        if (r.lineTotal && r.description && font.widthOfTextAtSize(r.description, 8) > DESC_MAX) {
          // Long description overflow fallback — wrap past DESC_MAX keeps us readable.
          // Already drawn truncated above; leave y advanced.
        }

        laborSum += (r.laborTotal || 0)
        partsSum += (r.partsTotal || 0)
        y -= 4
      }

      // TOTALS
      y -= 4
      need(80); hr(y, accent); y -= 18
      const sx = R - 180
      txt('Labor', sx, y, 10); txt(fmt(laborSum), R - 42, y, 10, true); y -= 18
      txt('Parts', sx, y, 10); txt(fmt(partsSum), R - 42, y, 10, true); y -= 18
      const subtotal = Number((est as any).subtotal) || (laborSum + partsSum)
      const storedTax = Number((est as any).tax_amount) || 0
      const total = Number((est as any).total ?? (est as any).grand_total) || (subtotal + storedTax)
      hr(y + 4, rule); y -= 14
      txt('Subtotal', sx, y, 10, false, mid); txt(fmt(subtotal), R - 42, y, 10, true); y -= 18
      if (storedTax > 0) {
        txt(`Tax (${shop?.tax_rate || 0}%${shop?.tax_labor ? ' incl. labor' : ' parts only'})`, sx, y, 9, false, mid)
        txt(fmt(storedTax), R - 42, y, 9); y -= 18
      }
      hr(y + 4, accent); y -= 16
      txt('Total', sx, y, 14, true); txt(fmt(total), R - 48, y, 14, true, money); y -= 28
    } else {
      // status-is-draft but zero lines AND no soId — render neutral placeholder
      txt('No line items available.', L, y, 10, false, mid); y -= 18
    }

    // Approval instructions + portal link
    need(70); hr(y, rule); y -= 16
    txt('APPROVAL', L, y, 9, true, accent); y -= 16
    wrap('Click the approval link in your email or visit the portal link below to approve this estimate. Once approved, the shop is authorized to begin the listed work. Additional repairs discovered during service will be sent to you for separate approval.', L, R - L, 9, false, dark)
    y -= 4
    if (portalLink) { txt('Portal:', L, y, 8, true, light); txt(portalLink, L + 40, y, 8, false, accent); y -= 16 }

    drawFooter()

    const pdfBytes = await pdf.save()
    const filename = sanitizeFilename(`Estimate-${estimateNumber || estimateId}.pdf`)
    return { pdfBytes, filename }
  } catch (err: any) {
    console.error('[estimate-pdf] generation failed', { estimateId, error: err?.message || String(err) })
    return null
  }
}
