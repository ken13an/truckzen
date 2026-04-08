import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { fetchInvoices, extractCustomers, extractTrucks, extractParts, mapServiceOrder, mapInvoice } from '@/lib/fullbay/client'
import { ADMIN_ROLES } from '@/lib/roles'

const ALLOWED_ROLES = ADMIN_ROLES

export async function POST(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ALLOWED_ROLES.includes(actor.role) && !actor.is_platform_owner) {
    return jsonError('Only shop owners can trigger data sync', 403)
  }

  const { type } = await params
  if (!['customers', 'trucks', 'parts', 'all'].includes(type)) return jsonError('Invalid type', 400)
  if (!process.env.FULLBAY_API_KEY) return jsonError('FULLBAY_API_KEY not configured', 500)

  const body = await req.json().catch(() => ({}))
  const s = createAdminSupabaseClient()

  const endD = body.end_date || new Date().toISOString().split('T')[0]
  const startD = body.start_date || (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0] })()

  const { data: log } = await s.from('fullbay_sync_log').insert({
    shop_id: shopId, sync_type: type, status: 'running', triggered_by: actor.id,
  }).select('id').single()
  const logId = log?.id

  try {
    const invoices = await fetchInvoices(startD, endD)
    let imported = 0, updated = 0, skipped = 0

    if (type === 'customers' || type === 'all') {
      const customers = extractCustomers(invoices)
      for (const [, record] of customers) {
        try {
          if (!record.company_name) { skipped++; continue }
          const { data: existing } = await s.from('customers').select('id').eq('shop_id', shopId)
            .or(`external_id.eq.${record.external_id},company_name.ilike.${record.company_name}`).limit(1)
          if (existing && existing.length > 0) {
            await s.from('customers').update(record).eq('id', existing[0].id); updated++
          } else {
            await s.from('customers').insert({ ...record, shop_id: shopId }); imported++
          }
        } catch { skipped++ }
      }
    }

    if (type === 'trucks' || type === 'all') {
      const trucks = extractTrucks(invoices)
      const { data: custList } = await s.from('customers').select('id, company_name, external_id').eq('shop_id', shopId)
      const custMap = new Map<string, string>()
      for (const c of custList || []) {
        if (c.external_id) custMap.set(c.external_id, c.id)
        custMap.set(c.company_name?.toLowerCase(), c.id)
      }

      for (const [, record] of trucks) {
        try {
          if (!record.unit_number) { skipped++; continue }
          const matchInv = invoices.find((inv: any) => {
            const u = inv.ServiceOrder?.Unit || {}
            return (u.vin === record.vin && record.vin) || u.number === record.unit_number
          })
          const custExtId = String(matchInv?.ServiceOrder?.Customer?.customerId || '')
          const custName = (matchInv?.ServiceOrder?.Customer?.title || '').toLowerCase()
          const customer_id = custMap.get(custExtId) || custMap.get(custName) || null

          const { data: existing } = await s.from('assets').select('id').eq('shop_id', shopId)
            .or(record.vin ? `vin.eq.${record.vin},unit_number.eq.${record.unit_number}` : `unit_number.eq.${record.unit_number}`)
            .limit(1)
          if (existing && existing.length > 0) {
            await s.from('assets').update({ ...record, customer_id }).eq('id', existing[0].id); updated++
          } else {
            await s.from('assets').insert({ ...record, shop_id: shopId, customer_id }); imported++
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
            const { data: existing } = await s.from('parts').select('id').eq('shop_id', shopId).eq('part_number', record.part_number).limit(1)
            if (existing && existing.length > 0) { updated++; continue }
          }
          await s.from('parts').insert({ ...record, shop_id: shopId }); imported++
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
