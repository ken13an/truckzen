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

  const { data, error } = await s
    .from('wo_activity_log')
    .select('*, users(full_name)')
    .eq('wo_id', woId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
