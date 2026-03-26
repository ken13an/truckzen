import type { SupabaseClient } from '@supabase/supabase-js'

export async function recalcWorkOrderTotals(s: SupabaseClient, soId: string) {
  const { data: lines } = await s
    .from('so_lines')
    .select('line_type, quantity, unit_price, total_price, parts_sell_price')
    .eq('so_id', soId)

  const laborTotal = (lines || [])
    .filter((l: any) => l.line_type === 'labor')
    .reduce((sum: number, l: any) => sum + Number(l.total_price || (Number(l.quantity || 1) * Number(l.unit_price || 0)) || 0), 0)

  const partsTotal = (lines || [])
    .filter((l: any) => l.line_type === 'part')
    .reduce((sum: number, l: any) => {
      const qty = Number(l.quantity || 1)
      const unit = Number(l.parts_sell_price ?? l.unit_price ?? 0)
      const total = Number(l.total_price ?? qty * unit)
      return sum + total
    }, 0)

  const grandTotal = laborTotal + partsTotal
  await s.from('service_orders').update({ labor_total: laborTotal, parts_total: partsTotal, grand_total: grandTotal }).eq('id', soId)
  return { laborTotal, partsTotal, grandTotal }
}
