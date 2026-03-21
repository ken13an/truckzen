import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchInvoices, extractCustomers, extractTrucks, extractParts, mapServiceOrder, mapInvoice } from '@/lib/fullbay/client'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const { shop_id, user_id, user_role, start_date, end_date } = await req.json()

  if (!user_role || !['owner', 'gm', 'it_person'].includes(user_role)) {
    return NextResponse.json({ error: 'Only shop owners can trigger data sync' }, { status: 403 })
  }
  if (!process.env.FULLBAY_API_KEY) return NextResponse.json({ error: 'FULLBAY_API_KEY not configured' }, { status: 500 })
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!['customers', 'trucks', 'parts', 'all'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const s = db()

  // Default: pull last 90 days
  const endD = end_date || new Date().toISOString().split('T')[0]
  const startD = start_date || (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0] })()

  const { data: log } = await s.from('fullbay_sync_log').insert({
    shop_id, sync_type: type, status: 'running', triggered_by: user_id || null,
  }).select('id').single()
  const logId = log?.id

  try {
    // All Fullbay data comes from invoices endpoint
    const invoices = await fetchInvoices(startD, endD)
    let imported = 0, updated = 0, skipped = 0

    if (type === 'customers' || type === 'all') {
      const customers = extractCustomers(invoices)
      for (const [, record] of customers) {
        try {
          if (!record.company_name) { skipped++; continue }
          const { data: existing } = await s.from('customers').select('id').eq('shop_id', shop_id)
            .or(`external_id.eq.${record.external_id},company_name.ilike.${record.company_name}`).limit(1)
          if (existing && existing.length > 0) {
            await s.from('customers').update(record).eq('id', existing[0].id); updated++
          } else {
            await s.from('customers').insert({ ...record, shop_id }); imported++
          }
        } catch { skipped++ }
      }
    }

    if (type === 'trucks' || type === 'all') {
      const trucks = extractTrucks(invoices)
      // Need customer IDs for linking
      const { data: custList } = await s.from('customers').select('id, company_name, external_id').eq('shop_id', shop_id)
      const custMap = new Map<string, string>()
      for (const c of custList || []) {
        if (c.external_id) custMap.set(c.external_id, c.id)
        custMap.set(c.company_name?.toLowerCase(), c.id)
      }

      for (const [, record] of trucks) {
        try {
          if (!record.unit_number) { skipped++; continue }
          // Link to customer via invoice data
          const matchInv = invoices.find((inv: any) => {
            const u = inv.ServiceOrder?.Unit || {}
            return (u.vin === record.vin && record.vin) || u.number === record.unit_number
          })
          const custExtId = String(matchInv?.ServiceOrder?.Customer?.customerId || '')
          const custName = (matchInv?.ServiceOrder?.Customer?.title || '').toLowerCase()
          const customer_id = custMap.get(custExtId) || custMap.get(custName) || null

          const { data: existing } = await s.from('assets').select('id').eq('shop_id', shop_id)
            .or(record.vin ? `vin.eq.${record.vin},unit_number.eq.${record.unit_number}` : `unit_number.eq.${record.unit_number}`)
            .limit(1)
          if (existing && existing.length > 0) {
            await s.from('assets').update({ ...record, customer_id }).eq('id', existing[0].id); updated++
          } else {
            await s.from('assets').insert({ ...record, shop_id, customer_id }); imported++
          }
        } catch { skipped++ }
      }
    }

    if (type === 'parts' || type === 'all') {
      const parts = extractParts(invoices)
      for (const [, record] of parts) {
        try {
          if (!record.description) { skipped++; continue }
          if (record.part_number) {
            const { data: existing } = await s.from('parts').select('id').eq('shop_id', shop_id).eq('part_number', record.part_number).limit(1)
            if (existing && existing.length > 0) { updated++; continue } // Don't overwrite existing parts inventory counts
          }
          await s.from('parts').insert({ ...record, shop_id }); imported++
        } catch { skipped++ }
      }
    }

    if (logId) {
      await s.from('fullbay_sync_log').update({
        status: 'completed', records_pulled: invoices.length,
        records_imported: imported + updated, records_skipped: skipped,
        completed_at: new Date().toISOString(),
      }).eq('id', logId)
    }

    return NextResponse.json({ imported, updated, skipped, total_invoices: invoices.length, log_id: logId })
  } catch (err: any) {
    if (logId) {
      await s.from('fullbay_sync_log').update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() }).eq('id', logId)
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
