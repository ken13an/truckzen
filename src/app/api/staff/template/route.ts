import { NextResponse } from 'next/server'
import { generateTemplate } from '@/lib/parseStaffFile'

export async function GET() {
  const buf = generateTemplate()
  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="TruckZen_Staff_Roster_Template.xlsx"',
    },
  })
}
