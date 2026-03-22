/**
 * TruckZen — Original Design
 * AI usage tracking, cost estimation, and rate limiting
 */

const COST_PER_INPUT_TOKEN = 0.000003   // $3 per million input tokens (Sonnet)
const COST_PER_OUTPUT_TOKEN = 0.000015  // $15 per million output tokens

interface AIUsageParams {
  shopId: string
  userId?: string
  feature: 'wo_creation' | 'parts_suggest' | 'service_writer' | 'ai_review' | 'other'
  tokensIn: number
  tokensOut: number
  model?: string
  durationMs?: number
  success?: boolean
  errorMessage?: string
}

export async function logAIUsage(supabase: any, params: AIUsageParams) {
  const totalTokens = params.tokensIn + params.tokensOut
  const estimatedCost = (params.tokensIn * COST_PER_INPUT_TOKEN) + (params.tokensOut * COST_PER_OUTPUT_TOKEN)

  await supabase.from('ai_usage_log').insert({
    shop_id: params.shopId,
    user_id: params.userId || null,
    feature: params.feature,
    model: params.model || 'claude-sonnet',
    tokens_in: params.tokensIn,
    tokens_out: params.tokensOut,
    total_tokens: totalTokens,
    estimated_cost: estimatedCost,
    request_duration_ms: params.durationMs || null,
    success: params.success ?? true,
    error_message: params.errorMessage || null,
  })

  return { totalTokens, estimatedCost }
}

export async function getMonthlyUsage(supabase: any, shopId: string) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('ai_usage_log')
    .select('tokens_in, tokens_out, estimated_cost, feature')
    .eq('shop_id', shopId)
    .gte('created_at', startOfMonth.toISOString())

  if (!data) return { totalCalls: 0, totalTokens: 0, totalCost: 0, byFeature: {} }

  const byFeature: Record<string, { calls: number; cost: number }> = {}
  let totalTokens = 0
  let totalCost = 0

  for (const row of data) {
    totalTokens += (row.tokens_in || 0) + (row.tokens_out || 0)
    totalCost += Number(row.estimated_cost || 0)
    if (!byFeature[row.feature]) byFeature[row.feature] = { calls: 0, cost: 0 }
    byFeature[row.feature].calls++
    byFeature[row.feature].cost += Number(row.estimated_cost || 0)
  }

  return { totalCalls: data.length, totalTokens, totalCost, byFeature }
}

export async function checkAILimit(supabase: any, shopId: string): Promise<{ allowed: boolean; usage: number; limit: number }> {
  const { data: shop } = await supabase
    .from('shops')
    .select('ai_monthly_limit, ai_usage_enabled')
    .eq('id', shopId)
    .single()

  if (!shop?.ai_usage_enabled) return { allowed: false, usage: 0, limit: 0 }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .gte('created_at', startOfMonth.toISOString())

  const usage = count || 0
  const limit = shop.ai_monthly_limit || 500

  return { allowed: usage < limit, usage, limit }
}
