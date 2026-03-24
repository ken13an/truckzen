import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const woId = searchParams.get('wo_id')
  if (!woId) return NextResponse.json({ error: 'wo_id required' }, { status: 400 })

  const { data, error } = await s.from('wo_charges').select('*').eq('wo_id', woId).order('created_at').limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { wo_id, description, amount, taxable } = body

  if (!wo_id || !description || amount == null)
    return NextResponse.json({ error: 'wo_id, description, and amount required' }, { status: 400 })

  const { data, error } = await s.from('wo_charges').insert({
    wo_id,
    description: description.trim(),
    amount: parseFloat(amount),
    taxable: taxable ?? false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await s.from('wo_charges').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
