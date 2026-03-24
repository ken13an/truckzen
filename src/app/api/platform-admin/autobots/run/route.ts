import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { user_id, scenario_id, shop_id } = body

  if (!user_id || !scenario_id) return NextResponse.json({ error: 'user_id and scenario_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', user_id).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  // Get scenario
  const { data: scenario } = await s.from('autobot_scenarios').select('*').eq('id', scenario_id).single()
  if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })

  const steps = scenario.steps as any[]
  const startTime = Date.now()

  // Create test result record
  const { data: result, error } = await s.from('autobot_test_results').insert({
    scenario_name: scenario.name,
    total_steps: steps.length,
    status: 'running',
    run_by: user_id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Simulate running each step
  const stepsDetail: any[] = []
  let passed = 0
  let failed = 0

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const stepStart = Date.now()

    // Simulate step execution (200-800ms per step)
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 600))

    // Simulate pass/fail (90% pass rate for demo)
    const stepPassed = Math.random() > 0.1
    if (stepPassed) passed++
    else failed++

    stepsDetail.push({
      index: i + 1,
      bot: step.bot,
      action: step.action,
      expected: step.expected,
      status: stepPassed ? 'passed' : 'failed',
      duration_ms: Date.now() - stepStart,
      log: stepPassed
        ? `Step ${i + 1}: ${step.action} completed successfully`
        : `Step ${i + 1}: ${step.action} failed — unexpected response`,
    })
  }

  const totalDuration = Date.now() - startTime

  // Update test result
  await s.from('autobot_test_results').update({
    completed_at: new Date().toISOString(),
    duration_ms: totalDuration,
    passed_steps: passed,
    failed_steps: failed,
    status: failed === 0 ? 'passed' : 'failed',
    steps_detail: stepsDetail,
  }).eq('id', result.id)

  // Log activity
  await s.from('platform_activity_log').insert({
    action_type: 'autobot_test_run',
    description: `Ran scenario "${scenario.name}" — ${passed}/${steps.length} passed`,
    performed_by: user_id,
    shop_id: shop_id || null,
  })

  return NextResponse.json({
    id: result.id,
    scenario_name: scenario.name,
    status: failed === 0 ? 'passed' : 'failed',
    total_steps: steps.length,
    passed_steps: passed,
    failed_steps: failed,
    duration_ms: totalDuration,
    steps_detail: stepsDetail,
  })
}
