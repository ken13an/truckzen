import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

const MAX_ROWS = 10000

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shop_id = getActorShopId(actor)
  if (!shop_id) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { rows, batch_id } = await req.json()

  if (!rows || !batch_id) return NextResponse.json({ error: 'rows and batch_id required' }, { status: 400 })
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS})` }, { status: 400 })

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

      let match = null
      if (row.part_number?.trim()) {
        match = existingParts.find(p => p.part_number?.toLowerCase() === row.part_number.trim().toLowerCase())
      }
      if (!match) {
        match = existingParts.find(p => p.description?.toLowerCase() === row.description.trim().toLowerCase())
      }

      if (match) {
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
        match.on_hand = newQty
        updated++
      } else {
        const { data: newPart } = await s.from('parts').insert({
          shop_id,
          source: 'csv_import',
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

  await s.from('import_history').insert({
    shop_id,
    import_type: 'parts',
    batch_id,
    total_rows: rows.length,
    imported_rows: created + updated,
    skipped_rows: skipped,
    status: 'completed',
    error_report: skippedRows.length > 0 ? skippedRows : null,
    imported_by: actor.id,
    undo_available_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })

  return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 50), batch_id, skipped_rows: skippedRows, updated_parts: updatedParts })
}
