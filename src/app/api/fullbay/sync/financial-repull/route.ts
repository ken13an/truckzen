import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { ADMIN_ROLES } from '@/lib/roles'
import { fetchInvoices, mapServiceOrder, mapInvoice } from '@/lib/fullbay/client'
import * as Sentry from '@sentry/nextjs'

/**
 * Targeted financial-only re-pull from Fullbay.
 * Updates ONLY financial fields on service_orders + invoices for historical Fullbay records.
 * Does NOT touch: assets, customers, ownership, non-historical records.
 */
export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor) || ''
  if (!shopId) return jsonError('No shop context', 400)
  if (!ADMIN_ROLES.includes(actor.impersonate_role || actor.role) && !(actor.is_platform_owner && !actor.impersonate_role)) {
    return jsonError('Only owners/admins can trigger financial re-pull', 403)
  }

  const body = await req.json().catch(() => ({}))
  if (!process.env.FULLBAY_API_KEY) return jsonError('FULLBAY_API_KEY not configured', 500)

  const startDate = body.start_date || '2021-02-01'
  const endDate = body.end_date || new Date().toISOString().split('T')[0]
  const dryRun = body.dry_run === true

  const s = createAdminSupabaseClient()

  // Pre-fetch all historical Fullbay WOs with their fullbay_id for fast lookup
  const { data: existingWOs } = await s.from('service_orders')
    .select('id, fullbay_id, so_number, grand_total, labor_total, parts_total')
    .eq('shop_id', shopId)
    .eq('source', 'fullbay')
    .eq('is_historical', true)
    .not('fullbay_id', 'is', null)

  const woByFbId = new Map<string, any>()
  const woBySONum = new Map<string, any>()
  for (const wo of existingWOs || []) {
    if (wo.fullbay_id) woByFbId.set(String(wo.fullbay_id), wo)
    if (wo.so_number) woBySONum.set(String(wo.so_number), wo)
  }

  let matched = 0, woUpdated = 0, invUpdated = 0, invCreated = 0, skipped = 0, totalPulled = 0
  const errors: string[] = []
  const samples: any[] = [] // first 5 changes for verification

  // Fetch all Fullbay invoices in the date range
  let allInvoices: any[]
  try {
    allInvoices = await fetchInvoices(startDate, endDate)
  } catch (err: any) {
    Sentry.captureException(err, { extra: { sync_type: 'financial_repull', shop_id: shopId } })
    return NextResponse.json({ error: `Fullbay fetch failed: ${err.message}` }, { status: 500 })
  }

  totalPulled = allInvoices.length

  for (const inv of allInvoices) {
    const so = inv.ServiceOrder || {}
    const fbId = String(so.serviceOrderId || inv.invoiceId || '')
    if (!fbId) { skipped++; continue }

    let existing = woByFbId.get(fbId)
    // Also try matching by repair order number → so_number
    if (!existing && so.repairOrderNumber) {
      existing = woBySONum.get(String(so.repairOrderNumber))
    }
    if (!existing) { skipped++; continue }

    matched++

    try {
      const mapped = mapServiceOrder(inv)
      const mappedInv = mapInvoice(inv)

      // Update service_orders financial fields ONLY
      const woUpdate: Record<string, any> = {
        grand_total: mapped.grand_total,
        labor_total: mapped.labor_total,
        parts_total: mapped.parts_total,
      }

      const woChanged = existing.grand_total !== woUpdate.grand_total ||
        existing.labor_total !== woUpdate.labor_total ||
        existing.parts_total !== woUpdate.parts_total

      if (woChanged && !dryRun) {
        await s.from('service_orders').update(woUpdate).eq('id', existing.id)
        woUpdated++
      } else if (woChanged) {
        woUpdated++
      }

      // Update or create invoice row
      const { data: existingInv } = await s.from('invoices')
        .select('id, total, amount_paid, balance_due, subtotal, tax_amount')
        .eq('so_id', existing.id)
        .limit(1)
        .single()

      const invData = {
        total: mappedInv.total,
        subtotal: mappedInv.subtotal,
        tax_amount: mappedInv.tax_amount,
        tax_rate: mappedInv.tax_rate,
        amount_paid: mappedInv.amount_paid,
        status: mappedInv.status,
      }

      if (existingInv) {
        const invChanged = existingInv.total !== invData.total ||
          existingInv.amount_paid !== invData.amount_paid ||
          existingInv.subtotal !== invData.subtotal ||
          existingInv.tax_amount !== invData.tax_amount

        if (invChanged && !dryRun) {
          await s.from('invoices').update(invData).eq('id', existingInv.id)
          invUpdated++
        } else if (invChanged) {
          invUpdated++
        }
      } else {
        // No invoice row exists — create one
        if (!dryRun) {
          await s.from('invoices').insert({
            shop_id: shopId,
            so_id: existing.id,
            invoice_number: `INV-FB-${so.repairOrderNumber || fbId}`,
            source: 'fullbay',
            is_historical: true,
            created_at: mappedInv.created_at || new Date().toISOString(),
            ...invData,
          })
        }
        invCreated++
      }

      // Collect sample for verification
      if (samples.length < 5 && woChanged) {
        samples.push({
          so_number: existing.so_number,
          fullbay_id: fbId,
          before: { grand_total: existing.grand_total, labor_total: existing.labor_total, parts_total: existing.parts_total },
          after: { grand_total: woUpdate.grand_total, labor_total: woUpdate.labor_total, parts_total: woUpdate.parts_total },
          invoice: { total: invData.total, amount_paid: invData.amount_paid, status: invData.status },
        })
      }
    } catch (err: any) {
      errors.push(`${existing.so_number} (${fbId}): ${err.message}`)
      if (errors.length > 50) break
    }
  }

  // Log sync
  if (!dryRun) {
    await s.from('fullbay_sync_log').insert({
      shop_id: shopId,
      sync_type: 'financial_repull',
      status: 'completed',
      triggered_by: actor.id,
      records_pulled: totalPulled,
      records_imported: woUpdated + invUpdated + invCreated,
      records_skipped: skipped,
      completed_at: new Date().toISOString(),
    }).then(() => {})
  }

  // Debug: show first 5 unmatched Fullbay IDs for diagnosis
  const unmatchedSamples: any[] = []
  for (const inv of allInvoices) {
    if (unmatchedSamples.length >= 5) break
    const so = inv.ServiceOrder || {}
    const fbId = String(so.serviceOrderId || inv.invoiceId || '')
    const roNum = String(so.repairOrderNumber || '')
    if (!woByFbId.has(fbId) && !woBySONum.has(roNum)) {
      unmatchedSamples.push({ fbId, roNum, invoiceId: inv.invoiceId, total: inv.total })
    }
  }

  return NextResponse.json({
    dry_run: dryRun,
    total_pulled: totalPulled,
    matched,
    skipped,
    wo_financial_updated: woUpdated,
    invoice_updated: invUpdated,
    invoice_created: invCreated,
    errors: errors.slice(0, 20),
    samples,
    unmatched_samples: unmatchedSamples,
    db_sample_fbids: Array.from(woByFbId.keys()).slice(0, 5),
    db_sample_sonums: Array.from(woBySONum.keys()).slice(0, 5),
  })
}
