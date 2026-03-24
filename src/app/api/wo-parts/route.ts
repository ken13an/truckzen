import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const woId = searchParams.get('wo_id')
  const lineId = searchParams.get('line_id')
  if (!woId && !lineId) return NextResponse.json({ error: 'wo_id or line_id required' }, { status: 400 })

  let q = s.from('wo_parts').select('*').order('created_at')
  if (woId) q = q.eq('wo_id', woId)
  if (lineId) q = q.eq('line_id', lineId)

  const { data, error } = await q.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { wo_id, line_id, part_number, description, quantity, unit_cost, user_id } = body
  if (!wo_id || !line_id || !description) return NextResponse.json({ error: 'wo_id, line_id, description required' }, { status: 400 })

  const { data, error } = await s.from('wo_parts').insert({
    wo_id, line_id,
    part_number: part_number?.trim() || null,
    description: description.trim(),
    quantity: parseInt(quantity) || 1,
    unit_cost: parseFloat(unit_cost) || 0,
    status: 'needed',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (user_id) {
    await s.from('wo_activity_log').insert({ wo_id, user_id, action: `Added part: ${description.trim()}` })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const s = db()
  const body = await req.json()
  const { id, status, quantity, unit_cost, wo_id, user_id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const update: Record<string, any> = {}
  if (status !== undefined) update.status = status
  if (quantity !== undefined) update.quantity = parseInt(quantity)
  if (unit_cost !== undefined) update.unit_cost = parseFloat(unit_cost)

  const { data, error } = await s.from('wo_parts').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (user_id && wo_id && status) {
    await s.from('wo_activity_log').insert({ wo_id, user_id, action: `Part status changed to ${status}` })
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await s.from('wo_parts').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
