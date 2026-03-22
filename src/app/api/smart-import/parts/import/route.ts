import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

// POST /api/smart-import/parts/import — bulk import parts with dedup
export async function POST(req: Request) {
  const s = db()
  const { rows, shop_id, batch_id, user_id } = await req.json()

  if (!rows || !shop_id || !batch_id) return NextResponse.json({ error: 'rows, shop_id, batch_id required' }, { status: 400 })

  // Pre-fetch existing parts for matching
  const { data: existing } = await s.from('parts').select('id, part_number, description, on_hand').eq('shop_id', shop_id)
  const existingParts = existing || []

  let created = 0, updated = 0, skipped = 0
  const errors: string[] = []
  const skippedRows: any[] = []
  const updatedParts: { id: string; prev_qty: number; added_qty: number }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      if (!row.description?.trim()) {
        skipped++; errors.push(`Row ${i + 1}: Missing description`)
        skippedRows.push({ ...row, _reason: 'Missing description' })
        continue
      }

      const qty = Math.round(parseFloat(String(row.quantity || '0').replace(/[^0-9.-]/g, '')) || 0)
      const costPrice = parseFloat(String(row.cost_price || '0').replace(/[$,]/g, '')) || 0
      const sellPrice = parseFloat(String(row.sell_price || '0').replace(/[$,]/g, '')) || 0

      // Match by part_number first, then description
      let match = null
      if (row.part_number?.trim()) {
        match = existingParts.find(p => p.part_number?.toLowerCase() === row.part_number.trim().toLowerCase())
      }
      if (!match) {
        match = existingParts.find(p => p.description?.toLowerCase() === row.description.trim().toLowerCase())
      }

      if (match) {
        // Update: add quantity to existing stock
        const newQty = (match.on_hand || 0) + qty
        await s.from('parts').update({
          on_hand: newQty,
          cost_price: costPrice || undefined,
          sell_price: sellPrice || undefined,
          vendor: row.vendor || undefined,
          bin_location: row.bin_location || undefined,
          import_batch_id: batch_id,
        }).eq('id', match.id)

        updatedParts.push({ id: match.id, prev_qty: match.on_hand || 0, added_qty: qty })
        match.on_hand = newQty // Update local cache
        updated++
      } else {
        // Insert new part
        const { data: newPart } = await s.from('parts').insert({
          shop_id,
          part_number: row.part_number?.trim() || null,
          description: row.description.trim(),
          category: row.category || 'Other',
          cost_price: costPrice,
          sell_price: sellPrice,
          on_hand: qty,
          reorder_point: 2,
          vendor: row.vendor || null,
          bin_location: row.bin_location || null,
          import_batch_id: batch_id,
        }).select('id, part_number, description, on_hand').single()

        if (newPart) existingParts.push(newPart)
        created++
      }
    } catch (err: any) {
      skipped++; errors.push(`Row ${i + 1}: ${err.message}`)
      skippedRows.push({ ...row, _reason: err.message })
    }
  }

  // Save import history
  if (user_id) {
    await s.from('import_history').insert({
      shop_id,
      import_type: 'parts',
      batch_id,
      total_rows: rows.length,
      imported_rows: created + updated,
      skipped_rows: skipped,
      status: 'completed',
      error_report: skippedRows.length > 0 ? skippedRows : null,
      imported_by: user_id,
      undo_available_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).then(() => {})
  }

  return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 50), batch_id, skipped_rows: skippedRows, updated_parts: updatedParts })
}
