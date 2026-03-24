import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', userId).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  // Get total count
  const { count } = await s.from('autobot_test_results').select('*', { count: 'exact', head: true })

  // Get paginated results
  const offset = (page - 1) * limit
  const { data: results, error } = await s.from('autobot_test_results')
    .select('*')
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Summary stats
  const { data: allResults } = await s.from('autobot_test_results').select('status, duration_ms, started_at')
  const total_runs = allResults?.length || 0
  const passed_runs = allResults?.filter((r: any) => r.status === 'passed').length || 0
  const pass_rate = total_runs > 0 ? Math.round((passed_runs / total_runs) * 100) : 0
  const avg_duration = total_runs > 0
    ? Math.round((allResults?.reduce((sum: number, r: any) => sum + (r.duration_ms || 0), 0) || 0) / total_runs)
    : 0
  const last_run = allResults?.[0]?.started_at || null

  return NextResponse.json({
    results: results || [],
    total: count || 0,
    page,
    pages: Math.ceil((count || 0) / limit),
    summary: {
      total_runs,
      pass_rate,
      avg_duration,
      last_run,
    },
  })
}
