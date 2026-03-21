import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decodeVIN } from '@/lib/integrations/nhtsa'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

// Simple string similarity for customer matching
function similarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim()
  const s2 = b.toLowerCase().trim()
  if (s1 === s2) return 1
  if (s1.length < 2 || s2.length < 2) return 0
  const bigrams1 = new Set<string>()
  for (let i = 0; i < s1.length - 1; i++) bigrams1.add(s1.substring(i, i + 2))
  const bigrams2: string[] = []
  for (let i = 0; i < s2.length - 1; i++) bigrams2.push(s2.substring(i, i + 2))
  let matches = 0
  for (const b of bigrams2) { if (bigrams1.has(b)) matches++ }
  return (2 * matches) / (bigrams1.size + bigrams2.length)
}

// POST /api/smart-import/trucks/import — bulk insert valid truck rows
export async function POST(req: Request) {
  const s = db()
  const { rows, shop_id, batch_id, user_id } = await req.json()

  if (!rows || !shop_id || !batch_id) {
    return NextResponse.json({ error: 'rows, shop_id, batch_id required' }, { status: 400 })
  }

  // Pre-fetch customers for matching
  const { data: customers } = await s.from('customers').select('id, company_name').eq('shop_id', shop_id)
  const custList = customers || []

  let imported = 0, updated = 0, skipped = 0
  const errors: string[] = []
  const skippedRows: any[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      if (!row.unit_number?.trim()) {
        skipped++
        errors.push(`Row ${i + 1}: Missing unit number`)
        skippedRows.push({ ...row, _reason: 'Missing unit number' })
        continue
      }

      const unitType = (row.type || row.unit_type || 'tractor').toLowerCase().trim()

      // Customer matching
      let customerId = null
      if (row.customer_name?.trim()) {
        const name = row.customer_name.trim()

        // Exact match
        const exact = custList.find((c: any) => c.company_name?.toLowerCase() === name.toLowerCase())
        if (exact) {
          customerId = exact.id
        } else {
          // Fuzzy match >= 85%
          let bestMatch: any = null, bestScore = 0
          for (const c of custList) {
            if (!c.company_name) continue
            const score = similarity(name, c.company_name)
            if (score > bestScore) { bestScore = score; bestMatch = c }
          }
          if (bestScore >= 0.85 && bestMatch) {
            customerId = bestMatch.id
          } else {
            // Create new customer
            const { data: newCust } = await s.from('customers').insert({
              shop_id,
              company_name: name,
              email: row.contact_email || null,
              phone: row.contact_phone || null,
            }).select('id').single()
            if (newCust) {
              customerId = newCust.id
              custList.push({ id: newCust.id, company_name: name })
            }
          }
        }
      }

      // VIN decode if provided and valid
      let vinYear = row.year ? parseInt(row.year) || null : null
      let vinMake = row.make || null
      let vinModel = row.model || null
      const cleanVin = row.vin ? row.vin.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '') : null

      if (cleanVin && cleanVin.length === 17) {
        try {
          const decoded = await decodeVIN(cleanVin)
          if (decoded.valid) {
            if (!vinYear && decoded.year) vinYear = decoded.year
            if (!vinMake && decoded.make) vinMake = decoded.make
            if (!vinModel && decoded.model) vinModel = decoded.model
          }
        } catch {}
      }

      const unitData: any = {
        shop_id,
        unit_number: row.unit_number.trim(),
        vin: cleanVin || null,
        year: vinYear,
        make: vinMake,
        model: vinModel,
        odometer: row.mileage ? parseInt(String(row.mileage).replace(/[^0-9]/g, '')) || null : null,
        license_plate: row.license_plate || null,
        unit_type: unitType,
        customer_id: customerId,
        import_batch_id: batch_id,
        status: 'on_road',
      }

      // Check if exists
      const { data: existing } = await s.from('assets')
        .select('id')
        .eq('shop_id', shop_id)
        .eq('unit_number', row.unit_number.trim())
        .limit(1)

      if (existing && existing.length > 0) {
        await s.from('assets').update(unitData).eq('id', existing[0].id)
        updated++
      } else {
        await s.from('assets').insert(unitData)
        imported++
      }
    } catch (err: any) {
      skipped++
      errors.push(`Row ${i + 1}: ${err.message || 'Unknown error'}`)
      skippedRows.push({ ...row, _reason: err.message || 'Unknown error' })
    }
  }

  // Save import history
  if (user_id) {
    await s.from('import_history').insert({
      shop_id,
      import_type: 'trucks',
      batch_id,
      total_rows: rows.length,
      imported_rows: imported + updated,
      skipped_rows: skipped,
      status: 'completed',
      error_report: skippedRows.length > 0 ? skippedRows : null,
      imported_by: user_id,
      undo_available_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  return NextResponse.json({ imported, updated, skipped, errors: errors.slice(0, 100), batch_id, skipped_rows: skippedRows })
}
