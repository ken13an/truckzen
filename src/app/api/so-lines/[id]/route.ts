import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const body = await req.json()

  const allowedFields = ['description', 'part_number', 'quantity', 'unit_price', 'total_price', 'finding', 'resolution', 'line_status', 'status', 'assigned_to', 'estimated_hours', 'actual_hours', 'billed_hours', 'labor_rate']
  const update: Record<string, any> = {}
  for (const f of allowedFields) {
    if (body[f] !== undefined) update[f] = body[f]
  }

  // Auto-calculate total_price if qty and price are set
  if (update.quantity !== undefined && update.unit_price !== undefined) {
    update.total_price = parseFloat(update.quantity) * parseFloat(update.unit_price)
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  const { data, error } = await s.from('so_lines').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalculate grand total
  const { data: allLines } = await s.from('so_lines').select('total_price').eq('so_id', data.so_id)
  const grandTotal = (allLines || []).reduce((sum: number, l: any) => sum + (l.total_price || 0), 0)
  await s.from('service_orders').update({ grand_total: grandTotal }).eq('id', data.so_id)

  return NextResponse.json({ ...data, updated_grand_total: grandTotal })
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params
  const s = db()

  const { data: line } = await s.from('so_lines').select('so_id').eq('id', id).single()
  await s.from('so_lines').delete().eq('id', id)

  if (line?.so_id) {
    const { data: allLines } = await s.from('so_lines').select('total_price').eq('so_id', line.so_id)
    const grandTotal = (allLines || []).reduce((sum: number, l: any) => sum + (l.total_price || 0), 0)
    await s.from('service_orders').update({ grand_total: grandTotal }).eq('id', line.so_id)
  }

  return NextResponse.json({ success: true })
}
