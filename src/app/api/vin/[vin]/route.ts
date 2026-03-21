import { NextResponse } from 'next/server'

const NHTSA_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin'

export async function GET(req: Request, { params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params
  const v = vin?.trim().toUpperCase()

  if (!v || v.length !== 17) {
    return NextResponse.json({ error: 'VIN must be 17 characters' }, { status: 400 })
  }

  try {
    const res = await fetch(`${NHTSA_URL}/${v}?format=json`)
    const data = await res.json()

    if (!data?.Results) {
      return NextResponse.json({ error: 'VIN decode failed' }, { status: 500 })
    }

    const getValue = (variableId: number): string => {
      const item = data.Results.find((r: any) => r.VariableId === variableId)
      return item?.Value?.trim() || ''
    }

    const decoded = {
      year: parseInt(getValue(29)) || null,
      make: getValue(26),
      model: getValue(28),
      body_type: getValue(5),
      engine: [getValue(146), getValue(18)].filter(Boolean).join(' ') || getValue(13) ? `${getValue(13)}L` : '',
      fuel_type: getValue(24),
      transmission: getValue(37),
      drive_type: getValue(15),
      gvwr: getValue(25),
      error_code: getValue(143),
    }

    return NextResponse.json(decoded)
  } catch {
    return NextResponse.json({ error: 'VIN decode service unavailable' }, { status: 502 })
  }
}
