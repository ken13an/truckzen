import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { decodeVIN } from '@/lib/integrations/nhtsa'

const MAX_ROWS = 10000

const TYPE_MAP: Record<string, string> = {
  tractor: 'tractor',
  trailer: 'trailer',
  'box truck': 'straight_truck',
  'straight truck': 'straight_truck',
  reefer: 'reefer',
  flatbed: 'flatbed',
  tanker: 'tanker',
}

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

function normalizeRow(row: any) {
  const clean = (v: any) => {
    if (typeof v !== 'string') return v ?? null
    const t = v.trim().replace(/\s+/g, ' ')
    return t === '' ? null : t
  }

  const vin = clean(row.vin)?.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '') || null

  return {
    unit_number: clean(row.unit_number),
    type: clean(row.type || row.unit_type)?.toLowerCase() || null,
    customer_name: clean(row.customer_name),
    vin,
    year: row.year ? parseInt(row.year) : null,
    make: clean(row.make),
    model: clean(row.model),
    mileage: row.mileage ? parseInt(String(row.mileage).replace(/[^0-9]/g, '')) || null : null,
    license_plate: clean(row.license_plate),
    contact_email: clean(row.contact_email),
    contact_phone: clean(row.contact_phone),
  }
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shop_id = getActorShopId(actor)
  if (!shop_id) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { rows, batch_id } = await req.json()

  if (!rows || !batch_id) return NextResponse.json({ error: 'rows and batch_id required' }, { status: 400 })
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS})` }, { status: 400 })

  const { data: customers } = await s.from('customers').select('id, company_name').eq('shop_id', shop_id)
  const custList = customers || []

  let imported = 0, updated = 0, skipped = 0
  const errors: string[] = []
  const skippedRows: any[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const r = normalizeRow(row)

    try {
      // Validation — same rules as preview
      const issues: string[] = []
      if (!r.unit_number) issues.push('Missing unit number')
      if (!r.customer_name) issues.push('Missing customer name')
      if (!r.type || !TYPE_MAP[r.type]) issues.push('Invalid type')
      if (r.vin && r.vin.length !== 17) issues.push('Invalid VIN')
      if (r.year !== null && (isNaN(r.year) || r.year < 1980 || r.year > new Date().getFullYear() + 1)) issues.push('Invalid year')

      if (issues.length > 0) {
        skipped++
        errors.push(`Row ${i + 1}: ${issues.join(', ')}`)
        skippedRows.push({ ...row, _reason: issues.join(', ') })
        continue
      }

      // Customer matching
      let customerId = null
      const name = r.customer_name!
      const exact = custList.find((c: any) => c.company_name?.toLowerCase() === name.toLowerCase())
      if (exact) {
        customerId = exact.id
      } else {
        let bestMatch: any = null, bestScore = 0
        for (const c of custList) {
          if (!c.company_name) continue
          const score = similarity(name, c.company_name)
          if (score > bestScore) { bestScore = score; bestMatch = c }
        }
        if (bestScore >= 0.92 && bestMatch) {
          customerId = bestMatch.id
        } else {
          const { data: newCust } = await s.from('customers').insert({
            shop_id,
            company_name: name,
            email: r.contact_email || null,
            phone: r.contact_phone || null,
          }).select('id').single()
          if (newCust) {
            customerId = newCust.id
            custList.push({ id: newCust.id, company_name: name })
          }
        }
      }

      // VIN decode
      let vinYear = r.year
      let vinMake = r.make
      let vinModel = r.model

      if (r.vin && r.vin.length === 17) {
        try {
          const decoded = await decodeVIN(r.vin)
          if (decoded.valid) {
            if (!vinYear && decoded.year) vinYear = decoded.year
            if (!vinMake && decoded.make) vinMake = decoded.make
            if (!vinModel && decoded.model) vinModel = decoded.model
          }
        } catch {}
      }

      const unitData: any = {
        shop_id,
        unit_number: r.unit_number,
        vin: r.vin || null,
        year: vinYear,
        make: vinMake,
        model: vinModel,
        odometer: r.mileage,
        license_plate: r.license_plate,
        unit_type: TYPE_MAP[r.type!],
        customer_id: customerId,
        import_batch_id: batch_id,
        status: 'on_road',
      }

      const { data: existing } = await s.from('assets').select('id').eq('shop_id', shop_id).eq('unit_number', r.unit_number!).limit(1)

      if (existing && existing.length > 0) {
        // Update existing asset but do NOT set import_batch_id — undo must not delete pre-existing assets
        const { import_batch_id: _, ...updateData } = unitData
        await s.from('assets').update(updateData).eq('id', existing[0].id)
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

  await s.from('import_history').insert({
    shop_id,
    import_type: 'trucks',
    batch_id,
    total_rows: rows.length,
    imported_rows: imported + updated,
    skipped_rows: skipped,
    status: skipped > 0 ? 'completed_with_errors' : 'completed',
    error_report: skippedRows.length > 0 ? skippedRows : null,
    imported_by: actor.id,
    undo_available_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })

  return NextResponse.json({ imported, updated, skipped, errors: errors.slice(0, 100), batch_id, skipped_rows: skippedRows })
}
