import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const { data, error } = await s.from('part_pricing_exceptions').select('*').eq('part_id', id).order('created_at', { ascending: false })
  if (error) return NextResponse.json([])
  return NextResponse.json(data || [])
}
