import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params
  const s = db()

  const { data, error } = await s
    .from('assets')
    .select('*, customers(id, company_name, phone, email)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const body = await req.json()

  const { data: current } = await s.from('assets').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateable = ['unit_number', 'vin', 'year', 'make', 'model', 'engine', 'odometer', 'status', 'customer_id', 'notes', 'ownership_type', 'unit_type', 'warranty_provider', 'warranty_start', 'warranty_expiry', 'warranty_mileage_limit', 'warranty_notes', 'warranty_coverage_type']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  const { data, error } = await s.from('assets').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params
  const s = db()

  await s.from('assets').update({ status: 'decommissioned' }).eq('id', id)
  return NextResponse.json({ success: true })
}
