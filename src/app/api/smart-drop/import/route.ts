import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function DELETE(req: Request) {
  const s = db()
  const { batch_id, shop_id } = await req.json()
  if (!batch_id || !shop_id) return NextResponse.json({ error: 'batch_id and shop_id required' }, { status: 400 })
  const { count } = await s.from('parts').delete({ count: 'exact' }).eq('import_batch_id', batch_id).eq('shop_id', shop_id)
  return NextResponse.json({ deleted: count || 0 })
}

export async function POST(req: Request) {
  const s = db()
  const { type, rows, shop_id, batch_id } = await req.json()

  if (!type || !rows || !shop_id) {
    return NextResponse.json({ error: 'type, rows, and shop_id required' }, { status: 400 })
  }

  let imported = 0, updated = 0, skipped = 0
  const errors: string[] = []
  const BATCH = 50

  if (type === 'trucks') {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      for (const row of batch) {
        try {
          if (!row.unit_number) { skipped++; errors.push(`Row ${i + batch.indexOf(row) + 1}: Missing unit number`); continue }

          // Find or create customer
          let customerId = null
          if (row.company_name) {
            const { data: existing } = await s.from('customers')
              .select('id')
              .eq('shop_id', shop_id)
              .ilike('company_name', row.company_name.trim())
              .limit(1)

            if (existing && existing.length > 0) {
              customerId = existing[0].id
            } else {
              const { data: newCust } = await s.from('customers')
                .insert({
                  shop_id,
                  company_name: row.company_name.trim(),
                  dot_number: row.dot || null,
                  mc_number: row.mc || null,
                  phone: row.phone || null,
                  contact_name: row.contact || null,
                  email: row.email || null,
                })
                .select('id')
                .single()
              if (newCust) customerId = newCust.id
            }
          }

          // Check if unit exists
          const { data: existingUnit } = await s.from('assets')
            .select('id')
            .eq('shop_id', shop_id)
            .eq('unit_number', row.unit_number.trim())
            .limit(1)

          const unitData: any = {
            shop_id,
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

          if (existingUnit && existingUnit.length > 0) {
            // Update
            await s.from('assets').update(unitData).eq('id', existingUnit[0].id)
            updated++
          } else {
            // Insert
            await s.from('assets').insert(unitData)
            imported++
          }
        } catch (err: any) {
          skipped++
          errors.push(`Row ${i + batch.indexOf(row) + 1}: ${err.message || 'Unknown error'}`)
        }
      }
    }
  } else if (type === 'companies') {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      for (const row of batch) {
        try {
          if (!row.company_name) { skipped++; errors.push(`Row ${i + batch.indexOf(row) + 1}: Missing company name`); continue }

          const { data: existing } = await s.from('customers')
            .select('id')
            .eq('shop_id', shop_id)
            .ilike('company_name', row.company_name.trim())
            .limit(1)

          const custData: any = {
            shop_id,
            company_name: row.company_name.trim(),
            dot_number: row.dot || null,
            mc_number: row.mc || null,
            phone: row.phone || null,
            contact_name: row.contact || null,
            email: row.email || null,
          }

          if (existing && existing.length > 0) {
            await s.from('customers').update(custData).eq('id', existing[0].id)
            updated++
          } else {
            await s.from('customers').insert(custData)
            imported++
          }
        } catch (err: any) {
          skipped++
          errors.push(`Row ${i + batch.indexOf(row) + 1}: ${err.message || 'Unknown error'}`)
        }
      }
    }
  } else if (type === 'contacts') {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      for (const row of batch) {
        try {
          if (!row.contact || !row.company_name) { skipped++; continue }
          const { data: cust } = await s.from('customers')
            .select('id')
            .eq('shop_id', shop_id)
            .ilike('company_name', row.company_name.trim())
            .limit(1)
          if (!cust || cust.length === 0) { skipped++; errors.push(`Row: No matching company "${row.company_name}"`); continue }

          await s.from('customer_contacts').insert({
            customer_id: cust[0].id,
            name: row.contact.trim(),
            phone: row.phone || null,
            email: row.email || null,
            role: row.role || null,
          })
          imported++
        } catch (err: any) {
          skipped++
          errors.push(`${err.message}`)
        }
      }
    }
  }

  if (type === 'parts') {
    const BATCH = 50
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      for (const row of batch) {
        try {
          if (!row.description?.trim()) { skipped++; errors.push(`Row ${i + batch.indexOf(row) + 1}: Missing description`); continue }

          // Clean numeric fields
          const costPrice = parseFloat(String(row.cost_price || '0').replace(/[$,]/g, '')) || 0
          const sellPrice = parseFloat(String(row.sell_price || '0').replace(/[$,]/g, '')) || 0
          const onHand = Math.round(parseFloat(String(row.on_hand || '0').replace(/[^0-9.-]/g, '')) || 0)
          const reorderPoint = Math.round(parseFloat(String(row.reorder_point || '0').replace(/[^0-9.-]/g, '')) || 0)

          // Dedup by part_number + description
          if (row.part_number?.trim()) {
            const { data: existing } = await s.from('parts')
              .select('id')
              .eq('shop_id', shop_id)
              .eq('part_number', row.part_number.trim())
              .limit(1)
            if (existing && existing.length > 0) {
              // Update existing
              await s.from('parts').update({
                description: row.description.trim(),
                category: row.category || null,
                cost_price: costPrice,
                sell_price: sellPrice,
                on_hand: onHand,
                reorder_point: reorderPoint,
                vendor: row.vendor || null,
                bin_location: row.bin_location || null,
                import_batch_id: batch_id || null,
              }).eq('id', existing[0].id)
              updated++
              continue
            }
          }

          await s.from('parts').insert({
            shop_id,
            part_number: row.part_number?.trim() || null,
            description: row.description.trim(),
            category: row.category || null,
            cost_price: costPrice,
            sell_price: sellPrice,
            on_hand: onHand,
            reorder_point: reorderPoint,
            vendor: row.vendor || null,
            bin_location: row.bin_location || null,
            import_batch_id: batch_id || null,
          })
          imported++
        } catch (err: any) {
          skipped++
          errors.push(`Row ${i + batch.indexOf(row) + 1}: ${err.message || 'Unknown error'}`)
        }
      }
    }
  }

  return NextResponse.json({ imported, updated, skipped, errors: errors.slice(0, 50) })
}
