import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const s = db()
  const { type, rows, shop_id } = await req.json()

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

  return NextResponse.json({ imported, updated, skipped, errors: errors.slice(0, 50) })
}
