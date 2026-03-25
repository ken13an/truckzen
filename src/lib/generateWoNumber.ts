import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generate the next WO number for a shop using the DB function next_wo_number().
 * Falls back to JS-based generation if the DB function doesn't exist.
 * Includes retry logic for race conditions (unique constraint violations).
 */
export async function generateWoNumber(supabase: SupabaseClient, shopId: string): Promise<string> {
  // Try the DB function first
  try {
    const { data, error } = await supabase.rpc('next_wo_number', { p_shop_id: shopId })
    if (!error && data) return data as string
  } catch {}

  // Fallback: JS-based generation using MAX
  const year = new Date().getFullYear()

  // Get highest WO-prefixed trailing number
  const { data: woRows } = await supabase
    .from('service_orders')
    .select('so_number')
    .eq('shop_id', shopId)
    .like('so_number', 'WO-%')
    .order('created_at', { ascending: false })
    .limit(100)

  let maxWo = 0
  for (const row of woRows || []) {
    const match = row.so_number?.match(/^WO-\d+-(\d+)$/)
    if (match) maxWo = Math.max(maxWo, parseInt(match[1]))
  }

  // Get highest plain numeric number
  const { data: plainRows } = await supabase
    .from('service_orders')
    .select('so_number')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(200)

  let maxPlain = 0
  for (const row of plainRows || []) {
    if (/^\d+$/.test(row.so_number || '')) {
      maxPlain = Math.max(maxPlain, parseInt(row.so_number))
    }
  }

  const next = Math.max(maxWo, maxPlain) + 1
  return `WO-${year}-${next}`
}

/**
 * Insert a service order with retry on duplicate WO number.
 * Retries up to 5 times, regenerating the number each time.
 */
export async function insertServiceOrder(
  supabase: SupabaseClient,
  shopId: string,
  fields: Record<string, any>
): Promise<{ data: any; error: any }> {
  let attempts = 0
  while (attempts < 5) {
    const woNum = await generateWoNumber(supabase, shopId)
    const { data, error } = await supabase
      .from('service_orders')
      .insert({ ...fields, shop_id: shopId, so_number: woNum })
      .select()
      .single()

    if (!error) return { data, error: null }

    // Check if it's a unique constraint violation
    if (error.code === '23505' && error.message?.includes('so_number')) {
      attempts++
      // Small delay to reduce collision chance
      await new Promise(r => setTimeout(r, 50 * attempts))
      continue
    }

    // Different error — don't retry
    return { data: null, error }
  }

  return { data: null, error: { message: 'Failed to generate unique WO number after 5 attempts', code: 'WO_GEN_FAILED' } }
}
