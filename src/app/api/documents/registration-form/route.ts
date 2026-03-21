import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const BLUE = rgb(29 / 255, 111 / 255, 232 / 255)
const DARK = rgb(26 / 255, 26 / 255, 26 / 255)
const GRAY = rgb(107 / 255, 114 / 255, 128 / 255)
const LINE_COLOR = rgb(209 / 255, 213 / 255, 219 / 255)
const LIGHT_BG = rgb(243 / 255, 244 / 255, 246 / 255)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id') || '1f927e3e-4fe5-431a-bb7c-dac77501e892'

  const s = db()
  const { data: shop } = await s.from('shops').select('name, dba, phone, email, address').eq('id', shopId).single()
  const shopName = shop?.dba || shop?.name || 'TruckZen'

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792]) // Letter size
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)

  let y = 750 // Start from top
  const L = 50 // Left margin
  const W = 512 // Usable width
  const R = 562 // Right edge

  // ── HEADER ──
  page.drawText('TruckZen', { x: L, y, size: 22, font: bold, color: BLUE })
  y -= 16
  page.drawText(shopName, { x: L, y, size: 9, font: regular, color: GRAY })
  y -= 11
  if (shop?.address) { page.drawText(shop.address, { x: L, y, size: 9, font: regular, color: GRAY }); y -= 11 }
  if (shop?.phone || shop?.email) { page.drawText([shop.phone, shop.email].filter(Boolean).join(' | '), { x: L, y, size: 9, font: regular, color: GRAY }); y -= 11 }

  // Title
  y -= 12
  page.drawText('NEW CUSTOMER REGISTRATION FORM', { x: L + 100, y, size: 14, font: bold, color: DARK })
  y -= 4
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1.5, color: BLUE })

  // ── HELPER FUNCTIONS ──
  function sectionHead(text: string) {
    y -= 18
    page.drawText(text, { x: L, y, size: 10, font: bold, color: BLUE })
    y -= 3
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: LINE_COLOR })
    y -= 4
  }

  function field(label: string, x: number, w: number) {
    page.drawText(label, { x, y, size: 7, font: regular, color: GRAY })
    page.drawLine({ start: { x, y: y - 12 }, end: { x: x + w, y: y - 12 }, thickness: 0.5, color: LINE_COLOR })
  }

  function checkBox(label: string, x: number, yPos: number) {
    page.drawRectangle({ x, y: yPos - 1, width: 9, height: 9, borderColor: LINE_COLOR, borderWidth: 0.5 })
    page.drawText(label, { x: x + 13, y: yPos, size: 8, font: regular, color: DARK })
  }

  // ── SECTION 1: COMPANY ──
  sectionHead('1. COMPANY INFORMATION')
  field('Company Name', L, W); y -= 24
  field('DOT #', L, W / 3 - 10); field('MC #', L + W / 3, W / 3 - 10); field('Tax ID / FEIN', L + (W / 3) * 2, W / 3); y -= 24
  field('Business Address', L, W); y -= 24
  field('City', L, W * 0.5 - 10); field('State', L + W * 0.5, W * 0.2 - 10); field('ZIP', L + W * 0.7, W * 0.3); y -= 24

  // ── SECTION 2: PRIMARY CONTACT ──
  sectionHead('2. PRIMARY CONTACT')
  field('Full Name', L, W * 0.5 - 10); field('Title / Role', L + W * 0.5, W * 0.5); y -= 24
  field('Phone', L, W * 0.5 - 10); field('Email', L + W * 0.5, W * 0.5); y -= 24
  page.drawText('Preferred Contact:', { x: L, y: y + 2, size: 8, font: regular, color: GRAY })
  checkBox('Call', L + 90, y + 2); checkBox('Text', L + 140, y + 2); checkBox('Email', L + 190, y + 2); y -= 14

  // ── SECTION 3: ADDITIONAL CONTACT ──
  sectionHead('3. ADDITIONAL CONTACT (optional)')
  field('Full Name', L, W * 0.5 - 10); field('Title / Role', L + W * 0.5, W * 0.5); y -= 24
  field('Phone', L, W * 0.5 - 10); field('Email', L + W * 0.5, W * 0.5); y -= 20

  // ── SECTION 4: BILLING ──
  sectionHead('4. BILLING INFORMATION')
  field('Billing Address (if different)', L, W); y -= 24
  page.drawText('Payment Terms:', { x: L, y: y + 2, size: 8, font: regular, color: GRAY })
  checkBox('COD', L + 90, y + 2); checkBox('Net 15', L + 145, y + 2); checkBox('Net 30', L + 210, y + 2); checkBox('Net 60', L + 275, y + 2)
  y -= 16
  page.drawText('Tax Exempt?', { x: L, y: y + 2, size: 8, font: regular, color: GRAY })
  checkBox('Yes', L + 70, y + 2); checkBox('No', L + 115, y + 2)
  page.drawText('Tax ID: ____________________', { x: L + 160, y: y + 2, size: 8, font: regular, color: GRAY })
  y -= 14

  // ── SECTION 5: UNITS TABLE ──
  sectionHead('5. UNIT INFORMATION')
  const cols = [
    { label: 'Unit #', w: 55 }, { label: 'Type', w: 50 }, { label: 'VIN', w: 120 },
    { label: 'Year', w: 35 }, { label: 'Make', w: 60 }, { label: 'Model', w: 55 },
    { label: 'Plate', w: 55 }, { label: 'State', w: 30 }, { label: 'Miles', w: 50 },
  ]
  // Header row
  let cx = L
  for (const col of cols) {
    page.drawRectangle({ x: cx, y: y - 12, width: col.w, height: 14, color: LIGHT_BG, borderColor: LINE_COLOR, borderWidth: 0.5 })
    page.drawText(col.label, { x: cx + 3, y: y - 8, size: 7, font: bold, color: DARK })
    cx += col.w
  }
  y -= 12
  // 5 empty rows
  for (let r = 0; r < 5; r++) {
    y -= 18
    cx = L
    for (const col of cols) {
      page.drawRectangle({ x: cx, y: y, width: col.w, height: 18, borderColor: LINE_COLOR, borderWidth: 0.5 })
      cx += col.w
    }
  }
  y -= 8

  // ── SECTION 6: AUTHORIZATION ──
  sectionHead('6. SERVICE AUTHORIZATION')
  checkBox('Always send estimate before starting repairs', L, y); y -= 16
  checkBox('Authorize repairs up to $____________', L, y); y -= 18

  // ── SECTION 7: SIGNATURE ──
  sectionHead('7. AGREEMENT & SIGNATURE')
  page.drawText(`By signing below, I authorize ${shopName} to inspect and service the listed vehicles.`, { x: L, y, size: 8, font: regular, color: GRAY })
  y -= 6
  page.drawText('I agree to pay for all authorized work per the terms above.', { x: L, y, size: 8, font: regular, color: GRAY })
  y -= 24
  page.drawLine({ start: { x: L, y }, end: { x: 300, y }, thickness: 0.5, color: LINE_COLOR })
  page.drawText('Signature', { x: L, y: y - 10, size: 8, font: regular, color: GRAY })
  page.drawLine({ start: { x: 340, y }, end: { x: R, y }, thickness: 0.5, color: LINE_COLOR })
  page.drawText('Date', { x: 340, y: y - 10, size: 8, font: regular, color: GRAY })
  y -= 24
  page.drawLine({ start: { x: L, y }, end: { x: 300, y }, thickness: 0.5, color: LINE_COLOR })
  page.drawText('Printed Name', { x: L, y: y - 10, size: 8, font: regular, color: GRAY })

  // ── FOOTER ──
  page.drawText(`Return this form to the front desk or email to ${shop?.email || 'the shop'}. Thank you for choosing ${shopName}!`, { x: L + 30, y: 35, size: 8, font: italic, color: GRAY })
  page.drawText('Powered by TruckZen — truckzen.pro', { x: L + 140, y: 22, size: 7, font: regular, color: rgb(0.6, 0.6, 0.6) })

  const pdfBytes = await pdf.save()

  return new NextResponse(pdfBytes as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="TruckZen-Registration-Form.pdf"',
    },
  })
}
