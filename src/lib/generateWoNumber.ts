import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generate the next WO number using the database sequence wo_number_seq.
 * Format: WO-123463, WO-123464, etc. (simple sequential, no year prefix)
 * Falls back to JS-based generation if the sequence doesn't exist.
 */
export async function generateWoNumber(supabase: SupabaseClient, shopId: string): Promise<string> {
  // Try the DB sequence first (race-condition safe)
  try {
    const { data, error } = await supabase.rpc('next_wo_number', { p_shop_id: shopId })
    if (!error && data) return data as string
  } catch {}

  // Fallback: use raw SQL nextval via the service_orders table trick
  // Query the sequence directly
  try {
    const { data: seqRows } = await supabase
      .from('service_orders')
      .select('so_number')
      .like('so_number', 'WO-%')
      .order('created_at', { ascending: false })
      .limit(200)

    let maxNum = 0
    for (const row of seqRows || []) {
      // Match WO-NNNNN or WO-YYYY-NNNNN
      const matchSimple = row.so_number?.match(/^WO-(\d+)$/)
      const matchYear = row.so_number?.match(/^WO-\d+-(\d+)$/)
      if (matchSimple) maxNum = Math.max(maxNum, parseInt(matchSimple[1]))
      if (matchYear) maxNum = Math.max(maxNum, parseInt(matchYear[1]))
    }

    // Also check plain numeric
    const { data: plainRows } = await supabase
      .from('service_orders')
      .select('so_number')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(200)

    for (const row of plainRows || []) {
      if (/^\d+$/.test(row.so_number || '')) {
        maxNum = Math.max(maxNum, parseInt(row.so_number))
      }
    }

    return `WO-${maxNum + 1}`
  } catch {
    // Last resort
    return `WO-${Date.now()}`
  }
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
    // Phase 1 lane defaults: all live TruckZen WOs are shop_internal
    const statusFamilyMap: Record<string, string> = { draft: 'draft', waiting_approval: 'waiting', in_progress: 'active', done: 'done', void: 'void' }
    const insertFields = {
      ...fields,
      shop_id: shopId,
      so_number: woNum,
      workorder_lane: fields.workorder_lane || 'shop_internal',
      status_family: fields.status_family || statusFamilyMap[fields.status as string] || 'draft',
    }
    const { data, error } = await supabase
      .from('service_orders')
      .insert(insertFields)
      .select()
      .single()

    if (!error) return { data, error: null }

    // Check if it's a unique constraint violation
    if (error.code === '23505' && error.message?.includes('so_number')) {
      attempts++
      await new Promise(r => setTimeout(r, 50 * attempts))
      continue
    }

    // Different error — don't retry
    return { data: null, error }
  }

  return { data: null, error: { message: 'Failed to generate unique WO number after 5 attempts', code: 'WO_GEN_FAILED' } }
}
