import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.is_platform_owner) return jsonError('Access denied', 403)

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  const { count } = await s.from('autobot_test_results').select('*', { count: 'exact', head: true })

  const offset = (page - 1) * limit
  const { data: results, error } = await s.from('autobot_test_results')
    .select('*').order('started_at', { ascending: false }).range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: allResults } = await s.from('autobot_test_results').select('status, duration_ms, started_at')
  const total_runs = allResults?.length || 0
  const passed_runs = allResults?.filter((r: any) => r.status === 'passed').length || 0
  const pass_rate = total_runs > 0 ? Math.round((passed_runs / total_runs) * 100) : 0
  const avg_duration = total_runs > 0
    ? Math.round((allResults?.reduce((sum: number, r: any) => sum + (r.duration_ms || 0), 0) || 0) / total_runs) : 0
  const last_run = allResults?.[0]?.started_at || null

  return NextResponse.json({
    results: results || [], total: count || 0, page, pages: Math.ceil((count || 0) / limit),
    summary: { total_runs, pass_rate, avg_duration, last_run },
  })
}
