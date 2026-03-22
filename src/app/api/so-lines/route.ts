import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const soId = searchParams.get('so_id')
  if (!soId) return NextResponse.json({ error: 'so_id required' }, { status: 400 })

  const { data, error } = await s.from('so_lines').select('*').eq('so_id', soId).order('sort_order').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { so_id, line_type, description, part_number, quantity, unit_price, line_status, rough_name, parts_status } = body

  if (!so_id || !line_type || !description)
    return NextResponse.json({ error: 'so_id, line_type, description required' }, { status: 400 })

  const qty = parseFloat(quantity) || 1
  const price = parseFloat(unit_price) || 0

  const { data, error } = await s.from('so_lines').insert({
    so_id,
    line_type,
    description: description.trim(),
    part_number: part_number?.trim() || null,
    quantity: qty,
    unit_price: price,
    line_status: line_status || null,
    rough_name: rough_name?.trim() || null,
    parts_status: parts_status || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalculate SO totals
  const { data: lines } = await s.from('so_lines').select('total_price, line_type').eq('so_id', so_id)
  const laborTotal = (lines || []).filter(l => l.line_type === 'labor').reduce((sum, l) => sum + (l.total_price || 0), 0)
  const partsTotal = (lines || []).filter(l => l.line_type === 'part').reduce((sum, l) => sum + (l.total_price || 0), 0)
  const grandTotal = (lines || []).reduce((sum, l) => sum + (l.total_price || 0), 0)

  await s.from('service_orders').update({ labor_total: laborTotal, parts_total: partsTotal, grand_total: grandTotal }).eq('id', so_id)

  return NextResponse.json(data, { status: 201 })
}
