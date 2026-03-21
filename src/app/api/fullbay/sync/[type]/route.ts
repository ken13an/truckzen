import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCustomers, fetchTrucks, fetchParts, mapCustomer, mapTruck, mapPart } from '@/lib/fullbay/client'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const { shop_id, user_id, user_role } = await req.json()

  // Security: only owner/it_person/gm can trigger Fullbay sync
  if (!user_role || !['owner', 'gm', 'it_person'].includes(user_role)) {
    return NextResponse.json({ error: 'Only shop owners can trigger data sync' }, { status: 403 })
  }
  if (!process.env.FULLBAY_API_KEY) return NextResponse.json({ error: 'FULLBAY_API_KEY not configured' }, { status: 500 })
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!['customers', 'trucks', 'parts'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const s = db()

  // Create sync log
  const { data: log } = await s.from('fullbay_sync_log').insert({ shop_id, sync_type: type, status: 'running', triggered_by: user_id || null }).select('id').single()
  const logId = log?.id

  try {
    // Fetch from Fullbay
    const fetchFn = type === 'customers' ? fetchCustomers : type === 'trucks' ? fetchTrucks : fetchParts
    const mapFn = type === 'customers' ? mapCustomer : type === 'trucks' ? mapTruck : mapPart
    const raw = await fetchFn()
    const mapped = raw.map(mapFn)

    let imported = 0, updated = 0, skipped = 0

    // Import based on type
    for (const record of mapped) {
      try {
        if (type === 'customers') {
          // Dedup by external_id or company_name
          const { data: existing } = await s.from('customers')
            .select('id').eq('shop_id', shop_id)
            .or(`external_id.eq.${record.external_id},company_name.ilike.${record.company_name}`)
            .limit(1)
          if (existing && existing.length > 0) {
            await s.from('customers').update(record).eq('id', existing[0].id)
            updated++
          } else {
            await s.from('customers').insert({ ...record, shop_id })
            imported++
          }
        } else if (type === 'trucks') {
          // Dedup by VIN or unit_number
          let query = s.from('assets').select('id').eq('shop_id', shop_id)
          if (record.vin && record.vin.length === 17) {
            query = query.eq('vin', record.vin)
          } else {
            query = query.eq('unit_number', record.unit_number)
          }
          const { data: existing } = await query.limit(1)
          if (existing && existing.length > 0) {
            await s.from('assets').update(record).eq('id', existing[0].id)
            updated++
          } else {
            await s.from('assets').insert({ ...record, shop_id })
            imported++
          }
        } else if (type === 'parts') {
          // Dedup by part_number
          if (record.part_number) {
            const { data: existing } = await s.from('parts')
              .select('id').eq('shop_id', shop_id).eq('part_number', record.part_number).limit(1)
            if (existing && existing.length > 0) {
              await s.from('parts').update(record).eq('id', existing[0].id)
              updated++
            } else {
              await s.from('parts').insert({ ...record, shop_id })
              imported++
            }
          } else {
            await s.from('parts').insert({ ...record, shop_id })
            imported++
          }
        }
      } catch {
        skipped++
      }
    }

    // Update log
    if (logId) {
      await s.from('fullbay_sync_log').update({
        status: 'completed', records_pulled: raw.length,
        records_imported: imported + updated, records_skipped: skipped,
        completed_at: new Date().toISOString(),
      }).eq('id', logId)
    }

    return NextResponse.json({ imported, updated, skipped, total_pulled: raw.length, log_id: logId })
  } catch (err: any) {
    if (logId) {
      await s.from('fullbay_sync_log').update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() }).eq('id', logId)
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
