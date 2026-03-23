import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mechanicId = searchParams.get('mechanic_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!mechanicId) return NextResponse.json({ error: 'mechanic_id required' }, { status: 400 })

  let query = db()
    .from('mechanic_unplanned_jobs')
    .select('*')
    .eq('mechanic_id', mechanicId)
    .order('created_at', { ascending: false })

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59')

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { shop_id, mechanic_id, description, duration_minutes, category } = body

  if (!shop_id || !mechanic_id || !description) {
    return NextResponse.json({ error: 'shop_id, mechanic_id, and description are required' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('mechanic_unplanned_jobs')
    .insert({
      shop_id,
      mechanic_id,
      description,
      duration_minutes: duration_minutes || null,
      category: category || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
