import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { description, part_number, quantity, unit_price } = body

  const qty       = quantity   !== undefined ? parseFloat(quantity)   : undefined
  const price     = unit_price !== undefined ? parseFloat(unit_price) : undefined
  const total     = (qty !== undefined && price !== undefined) ? qty * price : undefined

  const update: Record<string, any> = {}
  if (description !== undefined) update.description  = description.trim()
  if (part_number !== undefined) update.part_number  = part_number?.trim() || null
  if (qty         !== undefined) update.quantity     = qty
  if (price       !== undefined) update.unit_price   = price
  if (total       !== undefined) update.total_price  = total

  const { data, error } = await supabase.from('so_lines').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalculate grand total
  const { data: allLines } = await supabase.from('so_lines').select('total_price').eq('so_id', data.so_id)
  const grandTotal = (allLines || []).reduce((s, l) => s + (l.total_price || 0), 0)
  await supabase.from('service_orders').update({ grand_total: grandTotal }).eq('id', data.so_id)

  return NextResponse.json({ ...data, updated_grand_total: grandTotal })
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: line } = await supabase.from('so_lines').select('so_id').eq('id', id).single()
  await supabase.from('so_lines').delete().eq('id', id)

  if (line?.so_id) {
    const { data: allLines } = await supabase.from('so_lines').select('total_price').eq('so_id', line.so_id)
    const grandTotal = (allLines || []).reduce((s, l) => s + (l.total_price || 0), 0)
    await supabase.from('service_orders').update({ grand_total: grandTotal }).eq('id', line.so_id)
  }

  return NextResponse.json({ success: true })
}
