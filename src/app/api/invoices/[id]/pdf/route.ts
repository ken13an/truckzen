import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params
  const supabase = db()

  const { data: inv } = await supabase
    .from('invoices')
    .select(`
      *,
      service_orders(so_number, complaint, cause, correction,
        assets(unit_number, year, make, model, odometer),
        users!assigned_tech(full_name),
        so_lines(line_type, description, real_name, rough_name, part_number, quantity, unit_price, total_price, parts_sell_price, billed_hours, estimated_hours, actual_hours)
      ),
      customers(company_name, contact_name, phone, email, address, city, state, zip),
      shops(name, dba, phone, email, address, city, state, zip)
    `)
    .eq('id', id)
    .single()

  if (!inv) return new Response('Not found', { status: 404 })

  const so    = inv.service_orders as any
  const asset = so?.assets as any
  const shop  = inv.shops as any
  const cust  = inv.customers as any
  const lines = so?.so_lines || []

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792]) // Letter size
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0.1, 0.1, 0.1)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.85, 0.85, 0.85)
  const blue = rgb(0.11, 0.44, 0.91)

  let y = 740
  const leftMargin = 50
  const rightEdge = 562

  function drawText(text: string, x: number, yPos: number, options?: { font?: typeof font, size?: number, color?: typeof black }) {
    page.drawText(text || '', {
      x,
      y: yPos,
      size: options?.size || 10,
      font: options?.font || font,
      color: options?.color || black,
    })
  }

  function drawLine(x1: number, yPos: number, x2: number, color?: typeof black) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness: 0.5, color: color || lightGray })
  }

  // Shop header
  const shopName = shop?.dba || shop?.name || ''
  drawText(shopName, leftMargin, y, { font: fontBold, size: 16, color: blue })
  y -= 16
  if (shop?.address) {
    drawText(shop.address, leftMargin, y, { size: 9, color: gray })
    y -= 13
  }
  const shopCityLine = [shop?.city, shop?.state, shop?.zip].filter(Boolean).join(', ')
  if (shopCityLine) {
    drawText(shopCityLine, leftMargin, y, { size: 9, color: gray })
    y -= 13
  }
  if (shop?.phone) {
    drawText(shop.phone, leftMargin, y, { size: 9, color: gray })
    y -= 13
  }
  if (shop?.email) {
    drawText(shop.email, leftMargin, y, { size: 9, color: gray })
    y -= 13
  }

  // INVOICE header on the right
  drawText('INVOICE', rightEdge - fontBold.widthOfTextAtSize('INVOICE', 22), 740, { font: fontBold, size: 22, color: blue })

  // Invoice details block (right side)
  let ry = 714
  const detailLabels = [
    { label: 'Invoice #:', value: inv.invoice_number || '' },
    { label: 'Date:', value: inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '' },
    { label: 'Due Date:', value: inv.due_date || '' },
    { label: 'SO #:', value: so?.so_number || '' },
  ]
  for (const d of detailLabels) {
    const labelWidth = fontBold.widthOfTextAtSize(d.label, 9)
    drawText(d.label, rightEdge - 150, ry, { font: fontBold, size: 9, color: gray })
    drawText(d.value, rightEdge - 150 + labelWidth + 6, ry, { size: 9 })
    ry -= 14
  }

  // Bill To
  y = Math.min(y, ry) - 20
  drawLine(leftMargin, y + 8, rightEdge)
  drawText('BILL TO', leftMargin, y - 6, { font: fontBold, size: 9, color: gray })
  y -= 20
  if (cust?.company_name) { drawText(cust.company_name, leftMargin, y, { font: fontBold, size: 11 }); y -= 14 }
  if (cust?.contact_name) { drawText(cust.contact_name, leftMargin, y, { size: 9, color: gray }); y -= 13 }
  if (cust?.address) { drawText(cust.address, leftMargin, y, { size: 9, color: gray }); y -= 13 }
  const custCityLine = [cust?.city, cust?.state, cust?.zip].filter(Boolean).join(', ')
  if (custCityLine) { drawText(custCityLine, leftMargin, y, { size: 9, color: gray }); y -= 13 }
  if (cust?.phone) { drawText(cust.phone, leftMargin, y, { size: 9, color: gray }); y -= 13 }
  if (cust?.email) { drawText(cust.email, leftMargin, y, { size: 9, color: gray }); y -= 13 }

  // Vehicle info
  if (asset) {
    const vehicleStr = [asset.year, asset.make, asset.model].filter(Boolean).join(' ')
    drawText('VEHICLE', rightEdge - 200, y + 52, { font: fontBold, size: 9, color: gray })
    let vy = y + 38
    if (vehicleStr) { drawText(vehicleStr, rightEdge - 200, vy, { size: 9 }); vy -= 13 }
    if (asset.unit_number) { drawText('Unit #' + asset.unit_number, rightEdge - 200, vy, { size: 9, color: gray }); vy -= 13 }
    if (asset.odometer) { drawText('Odometer: ' + Number(asset.odometer).toLocaleString(), rightEdge - 200, vy, { size: 9, color: gray }) }
  }

  // Line items table
  y -= 20
  drawLine(leftMargin, y + 4, rightEdge, blue)

  // Table header
  const colX = { desc: leftMargin + 4, qty: 370, rate: 430, amount: 500 }
  y -= 4
  drawText('Description', colX.desc, y, { font: fontBold, size: 9, color: gray })
  drawText('Qty', colX.qty, y, { font: fontBold, size: 9, color: gray })
  drawText('Unit Price', colX.rate, y, { font: fontBold, size: 9, color: gray })
  drawText('Amount', colX.amount, y, { font: fontBold, size: 9, color: gray })
  y -= 6
  drawLine(leftMargin, y, rightEdge)
  y -= 14

  // Render lines grouped by type
  const groups = [
    { type: 'labor', label: 'LABOR' },
    { type: 'part', label: 'PARTS' },
    { type: 'other', label: 'OTHER' },
  ]

  for (const group of groups) {
    const groupLines = lines.filter((l: any) => {
      if (group.type === 'other') return !['labor', 'part'].includes(l.line_type)
      return l.line_type === group.type
    })
    if (!groupLines.length) continue

    // Group header
    drawText(group.label, colX.desc, y, { font: fontBold, size: 8, color: gray })
    y -= 14

    for (const l of groupLines) {
      if (y < 80) {
        // Add a new page if running out of space
        // For simplicity, just stop - most invoices fit one page
        drawText('... continued', colX.desc, y, { size: 8, color: gray })
        y -= 14
        break
      }
      const desc = (l.real_name || l.description || '').substring(0, 55)
      const price = l.line_type === 'part' ? (l.parts_sell_price || l.unit_price || 0) : (l.unit_price || 0)
      const qty = l.line_type === 'labor' ? (l.billed_hours || l.actual_hours || l.estimated_hours || l.quantity || 0) : (l.quantity || 0)
      const lineTotal = l.total_price || price * qty
      drawText(desc, colX.desc, y, { size: 9 })
      drawText(String(qty), colX.qty, y, { size: 9 })
      drawText('$' + price.toFixed(2), colX.rate, y, { size: 9 })
      drawText('$' + lineTotal.toFixed(2), colX.amount, y, { size: 9 })
      y -= 14
    }
    y -= 4
  }

  // Totals section
  y -= 6
  drawLine(colX.rate - 10, y + 8, rightEdge, blue)

  const totalsData = [
    { label: 'Subtotal:', value: inv.subtotal || 0 },
    { label: 'Tax:', value: inv.tax_amount || 0 },
    { label: 'Total:', value: inv.total || 0, bold: true },
    { label: 'Amount Paid:', value: inv.amount_paid || 0 },
    { label: 'Balance Due:', value: inv.balance_due || 0, bold: true },
  ]

  for (const t of totalsData) {
    drawText(t.label, colX.rate - 10, y, { font: t.bold ? fontBold : font, size: t.bold ? 11 : 9, color: t.bold ? black : gray })
    const valStr = '$' + t.value.toFixed(2)
    drawText(valStr, colX.amount, y, { font: t.bold ? fontBold : font, size: t.bold ? 11 : 9 })
    y -= t.bold ? 18 : 14
  }

  // Payment terms / notes
  if (inv.notes) {
    y -= 10
    drawText('Notes:', leftMargin, y, { font: fontBold, size: 9, color: gray })
    y -= 14
    // Wrap notes text simply
    const noteWords = inv.notes.split(' ')
    let currentLine = ''
    for (const word of noteWords) {
      const test = currentLine ? currentLine + ' ' + word : word
      if (font.widthOfTextAtSize(test, 9) > 400) {
        drawText(currentLine, leftMargin, y, { size: 9, color: gray })
        y -= 13
        currentLine = word
      } else {
        currentLine = test
      }
    }
    if (currentLine) {
      drawText(currentLine, leftMargin, y, { size: 9, color: gray })
      y -= 13
    }
  }

  // Payment terms
  if (inv.due_date) {
    y -= 6
    drawText('Payment due by ' + inv.due_date, leftMargin, y, { size: 9, color: gray })
  }

  const pdfBytes = await pdf.save()

  const filename = `Invoice-${inv.invoice_number || id}.pdf`
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
