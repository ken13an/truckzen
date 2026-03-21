import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

// GET /api/smart-import/trucks/template — download XLSX template
export async function GET() {
  const wb = new ExcelJS.Workbook()
  const BLUE = '1B6EE6'
  const DARK_BG = '0D0F12'
  const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
  const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'E5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
    left: { style: 'thin', color: { argb: 'E5E7EB' } },
    right: { style: 'thin', color: { argb: 'E5E7EB' } },
  }

  // ── Sheet 1: Instructions ──
  const inst = wb.addWorksheet('Instructions')
  inst.getColumn(1).width = 60

  const lines = [
    ['TruckZen — Truck Import Template'],
    [''],
    ['HOW TO USE THIS TEMPLATE:'],
    ['1. Fill in the "Trucks" sheet with your fleet data'],
    ['2. Save the file as .xlsx or .csv'],
    ['3. Upload at TruckZen → Smart Drop → Trucks tab'],
    ['4. Columns will be auto-mapped. Review and confirm.'],
    ['5. Preview your data, fix any issues, then import.'],
    [''],
    ['REQUIRED FIELDS:'],
    ['• unit_number — Your internal unit ID (e.g. UGL-001, T-100)'],
    ['• type — Must be "Tractor" or "Trailer"'],
    ['• customer_name — Must match an existing customer in TruckZen exactly'],
    [''],
    ['OPTIONAL FIELDS:'],
    ['• vin — 17-character Vehicle Identification Number (auto-decodes year/make/model)'],
    ['• year — 4-digit year (e.g. 2022)'],
    ['• make — e.g. Kenworth, Freightliner, Peterbilt, Volvo, Mack, International'],
    ['• model — e.g. T680, Cascadia, 579'],
    ['• license_plate — License plate number'],
    ['• license_state — 2-letter state code (e.g. TX, IL)'],
    ['• mileage — Current odometer reading (numbers only)'],
    ['• is_owner_operator — YES or NO (default: NO)'],
    ['• contact_email — Contact email for this truck/unit'],
    ['• contact_phone — Contact phone for this truck/unit'],
    ['• notes — Any additional notes'],
    [''],
    ['TIPS:'],
    ['• If you provide a VIN, year/make/model will be auto-decoded from NHTSA'],
    ['• Customer names are fuzzy-matched (85%+ similarity auto-matches)'],
    ['• Duplicate unit numbers will UPDATE existing records'],
    ['• You can undo an entire import within 24 hours'],
    [''],
    ['EXAMPLE ROW:'],
    ['unit_number: UGL-001 | vin: 1XKAD49X04J012345 | year: 2022 | make: Peterbilt | model: 579'],
    ['type: Tractor | customer_name: UGL Transport | mileage: 485000 | license_plate: TX-001'],
  ]
  for (const [text] of lines) {
    const row = inst.addRow([text])
    if (text === lines[0][0]) {
      row.getCell(1).font = { bold: true, size: 16, color: { argb: BLUE } }
    } else if (text.endsWith(':') || text === 'EXAMPLE ROW:') {
      row.getCell(1).font = { bold: true, size: 12, color: { argb: '333333' } }
    }
  }

  // ── Sheet 2: Trucks ──
  const trucks = wb.addWorksheet('Trucks')
  const headers = [
    'unit_number', 'vin', 'year', 'make', 'model', 'type',
    'license_plate', 'license_state', 'mileage', 'customer_name',
    'is_owner_operator', 'contact_email', 'contact_phone', 'notes',
  ]
  trucks.addRow(headers)

  // Style header
  const headerRow = trucks.getRow(1)
  headerRow.eachCell(cell => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle' }
  })
  headerRow.height = 24
  trucks.views = [{ state: 'frozen', ySplit: 1 }]
  trucks.autoFilter = { from: 'A1', to: 'N1' }

  // Example row
  const exampleRow = trucks.addRow([
    'UGL-001', '1XKAD49X04J012345', '2022', 'Peterbilt', '579', 'Tractor',
    'TX-001', 'TX', '485000', 'UGL Transport',
    'NO', 'driver@ugl.com', '(555) 123-4567', 'Example row — delete before importing',
  ])
  exampleRow.eachCell(c => { c.font = { color: { argb: '999999' }, italic: true } })

  // 100 blank rows
  for (let i = 0; i < 100; i++) trucks.addRow([])

  // Column widths
  trucks.columns = [
    { width: 16 }, { width: 22 }, { width: 8 }, { width: 16 }, { width: 16 }, { width: 12 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 28 },
    { width: 18 }, { width: 24 }, { width: 18 }, { width: 30 },
  ]

  // Borders
  for (let r = 2; r <= 102; r++) {
    const row = trucks.getRow(r)
    for (let c = 1; c <= 14; c++) row.getCell(c).border = THIN_BORDER
  }

  // Data validations
  for (let r = 3; r <= 102; r++) {
    trucks.getCell(`F${r}`).dataValidation = {
      type: 'list',
      formulae: ['"Tractor,Trailer,Straight Truck,Box Truck,Reefer,Flatbed,Tanker,Other"'],
      showErrorMessage: true,
      errorTitle: 'Invalid Type',
      error: 'Must be Tractor, Trailer, or other valid type',
    }
    trucks.getCell(`D${r}`).dataValidation = {
      type: 'list',
      formulae: ['"Kenworth,Freightliner,Peterbilt,Volvo,Mack,International,Western Star,Navistar,Hino,Great Dane,Wabash,Utility Trailer,Other"'],
      showErrorMessage: false,
    }
    trucks.getCell(`K${r}`).dataValidation = {
      type: 'list',
      formulae: ['"YES,NO"'],
      showErrorMessage: true,
    }
  }

  // Generate buffer
  const buf = await wb.xlsx.writeBuffer()

  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="TruckZen_Truck_Import_Template.xlsx"',
    },
  })
}
