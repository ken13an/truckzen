import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser, requireRole } from '@/lib/route-guards'
import { logAction } from '@/lib/services/auditLog'

const IMPORT_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'office_admin', 'service_writer'] as const

export async function DELETE(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, IMPORT_ROLES)
  if (roleError) return roleError

  const body = await req.json().catch(() => null)
  const batchId = typeof body?.batch_id === 'string' ? body.batch_id : ''
  const shopId = getActorShopId(actor)
  if (!batchId || !shopId) return NextResponse.json({ error: 'batch_id and shop context required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { count } = await s.from('parts').delete({ count: 'exact' }).eq('import_batch_id', batchId).eq('shop_id', shopId)
  logAction({ shop_id: shopId, user_id: actor.id, action: 'smart_drop_import.deleted', entity_type: 'import_batch', entity_id: batchId }).catch(() => {})
  return NextResponse.json({ deleted: count || 0 })
}

export async function POST(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, IMPORT_ROLES)
  if (roleError) return roleError

  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)
  const type = typeof body?.type === 'string' ? body.type : ''
  const rows = Array.isArray(body?.rows) ? body.rows : null
  const batchId = typeof body?.batch_id === 'string' ? body.batch_id : null
  const shopId = getActorShopId(actor)

  if (!type || !rows || !shopId) return NextResponse.json({ error: 'type, rows, and shop context required' }, { status: 400 })

  let imported = 0, updated = 0, skipped = 0
  const errors: string[] = []
  const BATCH = 50

  async function upsertRows(handler: (row: any, rowIndex: number) => Promise<void>) {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      for (const row of batch) {
        const rowIndex = i + batch.indexOf(row) + 1
        try {
          await handler(row, rowIndex)
        } catch (err: any) {
          skipped++
          errors.push(`Row ${rowIndex}: ${err?.message || 'Unknown error'}`)
        }
      }
    }
  }

  if (type === 'trucks') {
    await upsertRows(async (row, rowIndex) => {
      if (!row.unit_number) { skipped++; errors.push(`Row ${rowIndex}: Missing unit number`); return }
      let customerId = null
      if (row.company_name) {
        const { data: existing } = await s.from('customers').select('id').eq('shop_id', shopId).ilike('company_name', row.company_name.trim()).limit(1)
        if (existing?.length) customerId = existing[0].id
        else {
          const { data: newCust } = await s.from('customers').insert({
            shop_id: shopId,
            company_name: row.company_name.trim(),
            dot_number: row.dot || null,
            mc_number: row.mc || null,
            phone: row.phone || null,
            contact_name: row.contact || null,
            email: row.email || null,
          }).select('id').single()
          customerId = newCust?.id || null
        }
      }

      const { data: existingUnit } = await s.from('assets').select('id').eq('shop_id', shopId).eq('unit_number', row.unit_number.trim()).limit(1)
      const unitData: any = {
        shop_id: shopId,
        unit_number: row.unit_number.trim(),
        vin: row.vin || null,
        year: row.year ? parseInt(row.year) || null : null,
        make: row.make || null,
        model: row.model || null,
        odometer: row.mileage ? parseInt(String(row.mileage).replace(/[^0-9]/g, '')) || null : null,
        license_plate: row.license_plate || null,
        unit_type: row.unit_type || 'tractor',
        customer_id: customerId,
      }
      if (existingUnit?.length) { await s.from('assets').update(unitData).eq('id', existingUnit[0].id).eq('shop_id', shopId); updated++ }
      else { await s.from('assets').insert(unitData); imported++ }
    })
  } else if (type === 'companies') {
    await upsertRows(async (row, rowIndex) => {
      if (!row.company_name) { skipped++; errors.push(`Row ${rowIndex}: Missing company name`); return }
      const { data: existing } = await s.from('customers').select('id').eq('shop_id', shopId).ilike('company_name', row.company_name.trim()).limit(1)
      const custData: any = {
        shop_id: shopId,
        company_name: row.company_name.trim(),
        dot_number: row.dot || null,
        mc_number: row.mc || null,
        phone: row.phone || null,
        contact_name: row.contact || null,
        email: row.email || null,
      }
      if (existing?.length) { await s.from('customers').update(custData).eq('id', existing[0].id).eq('shop_id', shopId); updated++ }
      else { await s.from('customers').insert(custData); imported++ }
    })
  } else if (type === 'contacts') {
    await upsertRows(async (row) => {
      if (!row.contact || !row.company_name) { skipped++; return }
      const { data: cust } = await s.from('customers').select('id').eq('shop_id', shopId).ilike('company_name', row.company_name.trim()).limit(1)
      if (!cust?.length) { skipped++; errors.push(`No matching company \"${row.company_name}\"`); return }
      await s.from('customer_contacts').insert({ customer_id: cust[0].id, name: row.contact.trim(), phone: row.phone || null, email: row.email || null, role: row.role || null })
      imported++
    })
  } else if (type === 'parts') {
    await upsertRows(async (row, rowIndex) => {
      if (!row.description?.trim()) { skipped++; errors.push(`Row ${rowIndex}: Missing description`); return }
      const costPrice = parseFloat(String(row.cost_price || '0').replace(/[$,]/g, '')) || 0
      const sellPrice = parseFloat(String(row.sell_price || '0').replace(/[$,]/g, '')) || 0
      const onHand = Math.round(parseFloat(String(row.on_hand || '0').replace(/[^0-9.-]/g, '')) || 0)
      const reorderPoint = Math.round(parseFloat(String(row.reorder_point || '0').replace(/[^0-9.-]/g, '')) || 0)
      if (row.part_number?.trim()) {
        const { data: existing } = await s.from('parts').select('id').eq('shop_id', shopId).eq('part_number', row.part_number.trim()).limit(1)
        if (existing?.length) {
          await s.from('parts').update({ description: row.description.trim(), category: row.category || null, cost_price: costPrice, sell_price: sellPrice, on_hand: onHand, reorder_point: reorderPoint, vendor: row.vendor || null, bin_location: row.bin_location || null, import_batch_id: batchId || null }).eq('id', existing[0].id).eq('shop_id', shopId)
          updated++
          return
        }
      }
      await s.from('parts').insert({ shop_id: shopId, part_number: row.part_number?.trim() || null, description: row.description.trim(), category: row.category || null, cost_price: costPrice, sell_price: sellPrice, on_hand: onHand, reorder_point: reorderPoint, vendor: row.vendor || null, bin_location: row.bin_location || null, import_batch_id: batchId || null })
      imported++
    })
  } else {
    return NextResponse.json({ error: 'Unsupported import type' }, { status: 400 })
  }

  logAction({ shop_id: shopId, user_id: actor.id, action: 'smart_drop_import.completed', entity_type: 'import_batch', entity_id: batchId || type, details: { type, imported, updated, skipped, error_count: errors.length } }).catch(() => {})
  return NextResponse.json({ ok: true, imported, updated, skipped, errors: errors.slice(0, 200) })
}
