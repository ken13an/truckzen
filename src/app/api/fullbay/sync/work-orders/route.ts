import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'
import { fetchInvoices, mapCustomer, mapTruck, mapServiceOrder } from '@/lib/fullbay/client'
import * as Sentry from '@sentry/nextjs'

function db() { return createAdminSupabaseClient() }

// Simple string similarity
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

const STATUS_MAP: Record<string, string> = {
  'open': 'in_progress',
  'in progress': 'in_progress',
  'waiting': 'waiting_parts',
  'waiting for parts': 'waiting_parts',
  'completed': 'done',
  'done': 'done',
  'closed': 'done',
  'invoiced': 'done',
  'draft': 'draft',
}

// POST /api/fullbay/sync/work-orders — sync active WOs from Fullbay.
// Platform-owner only: writes cross-shop data using the shared
// FULLBAY_API_KEY and a service-role client, so the actor must prove
// platform-owner status on the server. Body-supplied user_role / user_id
// are ignored (previous F-04 pattern).
export async function POST(req: Request) {
  const { actor, error } = await requirePlatformOwner()
  if (error || !actor) return error!

  const { shop_id } = await req.json().catch(() => ({ shop_id: null }))
  if (!process.env.FULLBAY_API_KEY) return NextResponse.json({ error: 'FULLBAY_API_KEY not configured' }, { status: 500 })
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const s = db()

  try {
    // Pull last 30 days of invoices (which contain WO data)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })()

    const invoices = await fetchInvoices(startDate, endDate)

    // Pre-fetch existing data for matching
    const { data: customers } = await s.from('customers').select('id, company_name, external_id').eq('shop_id', shop_id)
    const custList = customers || []
    const { data: assets } = await s.from('assets').select('id, unit_number, vin').eq('shop_id', shop_id)
    const assetList = assets || []
    const { data: users } = await s.from('users').select('id, full_name, role').eq('shop_id', shop_id).or('is_autobot.is.null,is_autobot.eq.false')
    const userList = users || []

    let imported = 0, updated = 0, skipped = 0, preserved = 0
    const errors: string[] = []

    for (const inv of invoices) {
      const so = inv.ServiceOrder || {}
      const fbId = String(so.serviceOrderId || inv.invoiceId || '')
      if (!fbId) { skipped++; continue }

      try {
        // Check if already synced
        const { data: existing } = await s.from('service_orders')
          .select('id')
          .eq('shop_id', shop_id)
          .eq('fullbay_id', fbId)
          .limit(1)

        // Match customer
        let customerId = null
        const custData = mapCustomer(inv)
        if (custData.company_name) {
          // Exact external_id match
          const extMatch = custList.find((c: any) => c.external_id === custData.external_id && custData.external_id)
          if (extMatch) {
            customerId = extMatch.id
          } else {
            // Fuzzy match >= 85%
            let bestMatch: any = null, bestScore = 0
            for (const c of custList) {
              if (!c.company_name) continue
              const score = similarity(custData.company_name, c.company_name)
              if (score > bestScore) { bestScore = score; bestMatch = c }
            }
            if (bestScore >= 0.85 && bestMatch) {
              customerId = bestMatch.id
            } else {
              // Create placeholder customer
              const { data: newCust } = await s.from('customers').insert({
                shop_id,
                company_name: custData.company_name,
                phone: custData.phone,
                email: custData.email,
                source: 'fullbay',
                external_id: custData.external_id,
              }).select('id').single()
              if (newCust) {
                customerId = newCust.id
                custList.push({ id: newCust.id, company_name: custData.company_name, external_id: custData.external_id })
              }
            }
          }
        }

        // Match asset/unit
        let assetId = null
        const truckData = mapTruck(inv)
        if (truckData.unit_number || truckData.vin) {
          const unitMatch = assetList.find((a: any) =>
            (truckData.vin && a.vin === truckData.vin) ||
            (truckData.unit_number && a.unit_number === truckData.unit_number)
          )
          if (unitMatch) {
            assetId = unitMatch.id
          } else if (truckData.unit_number) {
            // Create placeholder asset
            const { data: newAsset } = await s.from('assets').insert({
              shop_id,
              unit_number: truckData.unit_number,
              vin: truckData.vin,
              year: truckData.year,
              make: truckData.make,
              model: truckData.model,
              unit_type: truckData.unit_type,
              customer_id: customerId,
              source: 'fullbay',
            }).select('id').single()
            if (newAsset) {
              assetId = newAsset.id
              assetList.push({ id: newAsset.id, unit_number: truckData.unit_number, vin: truckData.vin })
            }
          }
        }

        // Match technician by name
        let techId = null
        const techName = so.technicianName || so.assignedTech || ''
        if (techName) {
          const techMatch = userList.find((u: any) =>
            u.full_name?.toLowerCase() === techName.toLowerCase() &&
            ['technician', 'lead_tech', 'maintenance_technician'].includes(u.role)
          )
          if (techMatch) techId = techMatch.id
        }

        const mapped = mapServiceOrder(inv)
        const fbStatus = (so.status || '').toLowerCase()

        const woData: any = {
          shop_id,
          complaint: mapped.concern || so.description || null,
          status: STATUS_MAP[fbStatus] || 'in_progress',
          priority: mapped.priority || 'normal',
          source: 'fullbay',
          fullbay_id: fbId,
          fullbay_synced_at: new Date().toISOString(),
          customer_id: customerId,
          asset_id: assetId,
          assigned_tech: techId,
          labor_total: mapped.labor_total || 0,
          parts_total: mapped.parts_total || 0,
          grand_total: mapped.grand_total || 0,
        }

        if (existing && existing.length > 0) {
          // Non-destructive resync: existing Fullbay-imported WOs are preserved.
          // Once a row lands in TruckZen, accounting can correct labor/parts/
          // grand totals, customer/asset assignments, and status. A Fullbay
          // re-pull is a point-in-time snapshot, so overwriting an existing
          // row would silently erase those corrections. Insert-on-miss is the
          // intended import path; re-pulls treat already-known rows as
          // preserved. Mirrors the line-level "skip if exists" pattern used
          // immediately below for so_lines.
          preserved++
        } else {
          // Generate so_number
          const roNum = so.repairOrderNumber || fbId
          woData.so_number = `FB-${roNum}`

          await s.from('service_orders').insert(woData)
          imported++
        }

        // Sync line items (complaints → so_lines)
        const woId = existing?.[0]?.id || (await s.from('service_orders').select('id').eq('shop_id', shop_id).eq('fullbay_id', fbId).single())?.data?.id
        if (woId && so.Complaints) {
          for (const comp of so.Complaints) {
            for (const corr of comp.Corrections || []) {
              // Labor line
              if (corr.laborHours) {
                const { data: existLine } = await s.from('so_lines')
                  .select('id').eq('so_id', woId).eq('description', corr.description || comp.note || 'Labor').eq('line_type', 'labor').limit(1)
                if (!existLine || existLine.length === 0) {
                  await s.from('so_lines').insert({
                    so_id: woId,
                    line_type: 'labor',
                    description: corr.description || comp.note || 'Labor',
                    estimated_hours: parseFloat(corr.laborHours) || 0,
                    status: 'completed',
                  }).then(() => {})
                }
              }
              // Part lines
              for (const part of corr.Parts || []) {
                const pn = part.shopPartNumber || part.vendorPartNumber || ''
                if (pn) {
                  const { data: existPart } = await s.from('so_lines')
                    .select('id').eq('so_id', woId).eq('description', part.description || pn).eq('line_type', 'part').limit(1)
                  if (!existPart || existPart.length === 0) {
                    await s.from('so_lines').insert({
                      so_id: woId,
                      line_type: 'part',
                      description: part.description || pn,
                      quantity: parseInt(part.quantity) || 1,
                      total_price: parseFloat(part.sellingPrice) || 0,
                      status: 'completed',
                    }).then(() => {})
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        skipped++
        errors.push(`WO ${fbId}: ${err.message}`)
      }
    }

    // Log sync
    await s.from('fullbay_sync_log').insert({
      shop_id,
      sync_type: 'work_orders',
      status: 'completed',
      triggered_by: actor.id,
      records_pulled: invoices.length,
      records_imported: imported + updated,
      records_skipped: skipped,
      completed_at: new Date().toISOString(),
    }).then(() => {})

    return NextResponse.json({ imported, updated, skipped, preserved, total_pulled: invoices.length, errors: errors.slice(0, 20) })
  } catch (err: any) {
    Sentry.captureException(err, { extra: { sync_type: 'work-orders' } })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — get sync stats. Platform-owner only: the body-supplied shop_id
// returns counts/last-sync timestamp for arbitrary shops, so the actor must
// prove platform-owner status on the server (matches the POST handler gate).
export async function GET(req: Request) {
  const { error: authError } = await requirePlatformOwner()
  if (authError) return authError

  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const [
    { count: fbCount },
    { count: totalCount },
    { data: lastSync },
  ] = await Promise.all([
    s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('source', 'fullbay'),
    s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId),
    s.from('fullbay_sync_log').select('completed_at').eq('shop_id', shopId).eq('sync_type', 'work_orders').order('completed_at', { ascending: false }).limit(1),
  ])

  return NextResponse.json({
    fullbay_wos: fbCount || 0,
    total_wos: totalCount || 0,
    last_synced: lastSync?.[0]?.completed_at || null,
  })
}
