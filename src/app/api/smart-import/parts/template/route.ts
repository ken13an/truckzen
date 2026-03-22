import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export async function GET() {
  const wb = new ExcelJS.Workbook()
  const BLUE = '1B6EE6'
  const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
  const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'E5E7EB' } }, bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
    left: { style: 'thin', color: { argb: 'E5E7EB' } }, right: { style: 'thin', color: { argb: 'E5E7EB' } },
  }

  // Sheet 1: Instructions
  const inst = wb.addWorksheet('How to Use')
  inst.getColumn(1).width = 60
  const lines = [
    'TruckZen — Parts Purchase Template', '',
    'HOW TO USE:', '1. Fill in the "Parts" sheet with your purchased parts',
    '2. Save as .xlsx or .csv', '3. Go to Parts → Inventory tab → Bulk Add Parts',
    '4. Upload file, preview, then import', '',
    'REQUIRED FIELDS:', '• description — Part name', '• quantity — How many you received', '',
    'OPTIONAL FIELDS:', '• part_number — Your internal or supplier part number',
    '• category — Engine, Brakes, Electrical, Tires, Filters, etc.',
    '• cost_price — What you paid per unit', '• sell_price — What you charge the customer',
    '• vendor — Supplier name', '• bin_location — Where stored in warehouse', '• notes — Any notes', '',
    'DUPLICATE HANDLING:', '• If part_number matches existing → quantity is ADDED to current stock',
    '• If description matches existing (no part#) → quantity is ADDED', '• Otherwise → new part created', '',
    'EXAMPLE ROW:', 'part_number: BW-5020 | description: Brake Pad Set | category: Brakes',
    'cost_price: 45.00 | sell_price: 89.99 | quantity: 10 | vendor: FleetPride | bin_location: B-12',
  ]
  for (const text of lines) {
    const row = inst.addRow([text])
    if (text === lines[0]) row.getCell(1).font = { bold: true, size: 16, color: { argb: BLUE } }
    else if (text.endsWith(':')) row.getCell(1).font = { bold: true, size: 12, color: { argb: '333333' } }
  }

  // Sheet 2: Parts
  const parts = wb.addWorksheet('Parts')
  const headers = ['part_number', 'description', 'category', 'cost_price', 'sell_price', 'quantity', 'vendor', 'bin_location', 'notes']
  parts.addRow(headers)
  const headerRow = parts.getRow(1)
  headerRow.eachCell(cell => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = { vertical: 'middle' } })
  headerRow.height = 24
  parts.views = [{ state: 'frozen', ySplit: 1 }]
  parts.autoFilter = { from: 'A1', to: 'I1' }

  // Example row
  const ex = parts.addRow(['BW-5020', 'Brake Pad Set - Heavy Duty', 'Brakes', '45.00', '89.99', '10', 'FleetPride', 'B-12', 'Example — delete before import'])
  ex.eachCell(c => { c.font = { color: { argb: '999999' }, italic: true } })

  for (let i = 0; i < 50; i++) parts.addRow([])

  parts.columns = [{ width: 16 }, { width: 34 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 20 }, { width: 14 }, { width: 28 }]

  for (let r = 2; r <= 52; r++) {
    const row = parts.getRow(r)
    for (let c = 1; c <= 9; c++) row.getCell(c).border = THIN_BORDER
  }

  // Category dropdown
  for (let r = 3; r <= 52; r++) {
    parts.getCell(`C${r}`).dataValidation = {
      type: 'list',
      formulae: ['"Engine,Brakes,Electrical,Suspension,Drivetrain,Cooling,Exhaust,HVAC,Filters,Fluids,Body,Tires,Other"'],
      showErrorMessage: false,
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="TruckZen_Parts_Purchase_Template.xlsx"',
    },
  })
}
