import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

// GET /api/smart-import/trucks/history — list import history
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data, error } = await s.from('import_history')
    .select('*, users!imported_by(full_name)')
    .eq('shop_id', shopId)
    .eq('import_type', 'trucks')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (data || []).map((h: any) => ({
    ...h,
    imported_by_name: h.users?.full_name || '—',
    undo_available: h.status !== 'undone' && h.undo_available_until && new Date(h.undo_available_until) > new Date(),
  }))

  return NextResponse.json(enriched)
}
