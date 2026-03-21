import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import PDFDocument from 'pdfkit'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const BLUE = '#1D6FE8'
const DARK = '#1A1A1A'
const GRAY = '#6B7280'
const LIGHT = '#F3F4F6'
const LINE = '#D1D5DB'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id') || '1f927e3e-4fe5-431a-bb7c-dac77501e892'

  const s = db()
  const { data: shop } = await s.from('shops').select('name, dba, phone, email, address, state, county').eq('id', shopId).single()
  const shopName = shop?.dba || shop?.name || 'TruckZen'
  const shopAddr = shop?.address || ''
  const shopPhone = shop?.phone || ''
  const shopEmail = shop?.email || ''

  const doc = new PDFDocument({ size: 'letter', margins: { top: 40, bottom: 40, left: 50, right: 50 } })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  const pageW = 612 - 100 // letter width minus margins

  // ── HEADER ──
  doc.fontSize(22).font('Helvetica-Bold').fillColor(BLUE).text('TruckZen', 50, 40)
  doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(shopName, 50, 65)
  if (shopAddr) doc.text(shopAddr, 50, 76)
  if (shopPhone || shopEmail) doc.text([shopPhone, shopEmail].filter(Boolean).join(' | '), 50, 87)

  // Title
  doc.moveDown(1.5)
  const titleY = doc.y
  doc.fontSize(16).font('Helvetica-Bold').fillColor(DARK).text('NEW CUSTOMER REGISTRATION FORM', { align: 'center' })
  doc.moveTo(50, titleY + 22).lineTo(562, titleY + 22).strokeColor(BLUE).lineWidth(1.5).stroke()

  // ── SECTION 1: COMPANY INFORMATION ──
  doc.moveDown(1)
  sectionHeader(doc, '1. COMPANY INFORMATION')
  const s1y = doc.y + 4
  fieldLine(doc, 'Company Name', s1y, 50, pageW)
  fieldLine(doc, 'DOT #', s1y + 30, 50, pageW / 3 - 10)
  fieldLine(doc, 'MC #', s1y + 30, 50 + pageW / 3, pageW / 3 - 10)
  fieldLine(doc, 'Tax ID / FEIN', s1y + 30, 50 + (pageW / 3) * 2, pageW / 3)
  fieldLine(doc, 'Business Address', s1y + 60, 50, pageW)
  fieldLine(doc, 'City', s1y + 90, 50, pageW * 0.5 - 10)
  fieldLine(doc, 'State', s1y + 90, 50 + pageW * 0.5, pageW * 0.2 - 10)
  fieldLine(doc, 'ZIP', s1y + 90, 50 + pageW * 0.7, pageW * 0.3)
  doc.y = s1y + 125

  // ── SECTION 2: PRIMARY CONTACT ──
  sectionHeader(doc, '2. PRIMARY CONTACT')
  const s2y = doc.y + 4
  fieldLine(doc, 'Full Name', s2y, 50, pageW * 0.5 - 10)
  fieldLine(doc, 'Title / Role', s2y, 50 + pageW * 0.5, pageW * 0.5)
  fieldLine(doc, 'Phone', s2y + 30, 50, pageW * 0.5 - 10)
  fieldLine(doc, 'Email', s2y + 30, 50 + pageW * 0.5, pageW * 0.5)
  // Preferred contact
  doc.fontSize(8).font('Helvetica').fillColor(GRAY).text('Preferred Contact:', 50, s2y + 62)
  checkbox(doc, 'Call', 140, s2y + 61)
  checkbox(doc, 'Text', 195, s2y + 61)
  checkbox(doc, 'Email', 250, s2y + 61)
  doc.y = s2y + 80

  // ── SECTION 3: ADDITIONAL CONTACT ──
  sectionHeader(doc, '3. ADDITIONAL CONTACT (optional)')
  const s3y = doc.y + 4
  fieldLine(doc, 'Full Name', s3y, 50, pageW * 0.5 - 10)
  fieldLine(doc, 'Title / Role', s3y, 50 + pageW * 0.5, pageW * 0.5)
  fieldLine(doc, 'Phone', s3y + 30, 50, pageW * 0.5 - 10)
  fieldLine(doc, 'Email', s3y + 30, 50 + pageW * 0.5, pageW * 0.5)
  doc.y = s3y + 65

  // ── SECTION 4: BILLING ──
  sectionHeader(doc, '4. BILLING INFORMATION')
  const s4y = doc.y + 4
  fieldLine(doc, 'Billing Address (if different)', s4y, 50, pageW)
  doc.fontSize(8).font('Helvetica').fillColor(GRAY).text('Payment Terms:', 50, s4y + 32)
  checkbox(doc, 'COD', 140, s4y + 31)
  checkbox(doc, 'Net 15', 195, s4y + 31)
  checkbox(doc, 'Net 30', 260, s4y + 31)
  checkbox(doc, 'Net 60', 325, s4y + 31)
  doc.fontSize(8).font('Helvetica').fillColor(GRAY).text('Tax Exempt?', 50, s4y + 48)
  checkbox(doc, 'Yes', 120, s4y + 47)
  checkbox(doc, 'No', 170, s4y + 47)
  doc.text('Tax ID: ____________________', 210, s4y + 48)
  doc.y = s4y + 68

  // ── SECTION 5: UNITS ──
  sectionHeader(doc, '5. UNIT INFORMATION')
  const tblY = doc.y + 4
  const cols = [
    { label: 'Unit #', w: 55 },
    { label: 'Type (T/TR)', w: 65 },
    { label: 'VIN', w: 120 },
    { label: 'Year', w: 35 },
    { label: 'Make', w: 60 },
    { label: 'Model', w: 60 },
    { label: 'Plate', w: 55 },
    { label: 'State', w: 35 },
  ]
  // Header row
  let cx = 50
  doc.fontSize(7).font('Helvetica-Bold').fillColor(DARK)
  for (const col of cols) {
    doc.rect(cx, tblY, col.w, 16).fillAndStroke(LIGHT, LINE)
    doc.fillColor(DARK).text(col.label, cx + 3, tblY + 4, { width: col.w - 6 })
    cx += col.w
  }
  // 5 empty rows
  for (let r = 0; r < 5; r++) {
    cx = 50
    const ry = tblY + 16 + r * 20
    for (const col of cols) {
      doc.rect(cx, ry, col.w, 20).stroke(LINE)
      cx += col.w
    }
  }
  doc.y = tblY + 16 + 5 * 20 + 8

  // ── SECTION 6: AUTHORIZATION ──
  sectionHeader(doc, '6. SERVICE AUTHORIZATION')
  const s6y = doc.y + 4
  checkbox(doc, 'Always send estimate before starting repairs', 50, s6y)
  checkbox(doc, 'Authorize repairs up to $____________', 50, s6y + 18)
  doc.y = s6y + 42

  // ── SECTION 7: SIGNATURE ──
  sectionHeader(doc, '7. AGREEMENT & SIGNATURE')
  doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(
    `By signing below, I authorize ${shopName} to inspect and service the vehicles listed above in accordance with estimates provided. I agree to pay for all authorized work.`,
    50, doc.y + 4, { width: pageW }
  )
  doc.moveDown(1.5)
  const sigY = doc.y
  doc.moveTo(50, sigY).lineTo(300, sigY).stroke(LINE)
  doc.fontSize(8).fillColor(GRAY).text('Signature', 50, sigY + 3)
  doc.moveTo(340, sigY).lineTo(562, sigY).stroke(LINE)
  doc.text('Date', 340, sigY + 3)
  doc.moveDown(1.5)
  const nameY = doc.y
  doc.moveTo(50, nameY).lineTo(300, nameY).stroke(LINE)
  doc.text('Printed Name', 50, nameY + 3)

  // ── FOOTER ──
  doc.moveDown(2)
  doc.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY).text(
    `Please return this form to the front desk or email to ${shopEmail || 'the shop'}. Thank you for choosing ${shopName}!`,
    50, doc.y, { align: 'center', width: pageW }
  )
  doc.fontSize(7).fillColor('#9CA3AF').text('Powered by TruckZen — truckzen.pro', 50, 740, { align: 'center', width: pageW })

  doc.end()

  const pdf = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="TruckZen-Registration-Form.pdf"',
    },
  })
}

// ── HELPERS ──

function sectionHeader(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.3)
  doc.fontSize(10).font('Helvetica-Bold').fillColor(BLUE).text(text)
  doc.moveTo(50, doc.y + 1).lineTo(562, doc.y + 1).strokeColor('#E5E7EB').lineWidth(0.5).stroke()
  doc.moveDown(0.3)
}

function fieldLine(doc: PDFKit.PDFDocument, label: string, y: number, x: number, w: number) {
  doc.fontSize(7).font('Helvetica').fillColor(GRAY).text(label, x, y)
  doc.moveTo(x, y + 18).lineTo(x + w, y + 18).strokeColor(LINE).lineWidth(0.5).stroke()
}

function checkbox(doc: PDFKit.PDFDocument, label: string, x: number, y: number) {
  doc.rect(x, y, 9, 9).strokeColor(LINE).lineWidth(0.5).stroke()
  doc.fontSize(8).font('Helvetica').fillColor(DARK).text(label, x + 13, y + 0.5)
}
