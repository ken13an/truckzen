import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAction } from '@/lib/services/auditLog'
import { checkRateLimit } from '@/lib/rateLimit'
import { insertServiceOrder } from '@/lib/generateWoNumber'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { deriveWOAutomation } from '@/lib/wo-automation'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = db()
  const { searchParams } = new URL(req.url)

  if (!checkRateLimit(`${actor.id}:work-orders`, 200, 60000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const status = searchParams.get('status')
  const search = searchParams.get('q')
  const historical = searchParams.get('historical')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25'), 50)
  const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1)
  const offset = (page - 1) * limit

  // Build query with count
  let q = s
    .from('service_orders')
    .select(`
      id, so_number, status, priority, complaint, bay, team, source, is_historical,
      grand_total, created_at, updated_at, submitted_at, assigned_tech, ownership_type,
      estimate_required, estimate_approved, estimate_status, estimate_sent_at, estimate_approved_at,
      invoice_status, invoiced_at, promised_date, repair_completed_at, parts_completed_at,
      assets(id, unit_number, year, make, model, ownership_type),
      customers(id, company_name),
      users!assigned_tech(id, full_name)
    `, { count: 'exact' })
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .not('status', 'eq', 'void')
    .order('created_at', { ascending: false })

  // Exclude autosave drafts from normal views
  const includeDrafts = searchParams.get('include_drafts')
  if (includeDrafts !== 'true') {
    q = q.not('so_number', 'like', 'DRAFT-%')
  }

  if (status && status !== 'all') q = q.eq('status', status)
  if (historical === 'false') q = q.or('is_historical.is.null,is_historical.eq.false')
  if (historical === 'true') q = q.eq('is_historical', true)

  const warrantyFilter = searchParams.get('warranty_status')
  if (warrantyFilter) q = q.eq('warranty_status', warrantyFilter)

  // Server-side search across WO number, complaint, customer name, unit number, VIN
  if (search) {
    // Find matching customer and asset IDs first (PostgREST can't filter on joined columns)
    const [{ data: matchCust }, { data: matchAsset }] = await Promise.all([
      s.from('customers').select('id').eq('shop_id', shopId).ilike('company_name', `%${search}%`),
      s.from('assets').select('id').eq('shop_id', shopId).or(`unit_number.ilike.%${search}%,vin.ilike.%${search}%`),
    ])
    const custIds = (matchCust || []).map((c: any) => c.id)
    const assetIds = (matchAsset || []).map((a: any) => a.id)

    // Build OR filter: WO fields + matched customer/asset IDs
    const orParts = [`so_number.ilike.%${search}%`, `complaint.ilike.%${search}%`]
    if (custIds.length > 0) orParts.push(`customer_id.in.(${custIds.join(',')})`)
    if (assetIds.length > 0) orParts.push(`asset_id.in.(${assetIds.join(',')})`)
    q = q.or(orParts.join(','))
  }

  // Apply pagination
  q = q.range(offset, offset + limit - 1)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = count ?? 0
  // Add lightweight automation to each WO in list
  const enriched = (data || []).map((wo: any) => ({
    ...wo,
    automation: deriveWOAutomation(wo),
  }))
  return NextResponse.json({
    data: enriched,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shop_id = getActorShopId(actor)
  if (!shop_id) return jsonError('No shop context', 400)
  const user_id = actor.id

  const s = db()
  const body = await req.json()
  const { asset_id, customer_id, complaint, priority, job_lines, mileage, job_type, estimate_required: bodyEstimateRequired } = body
  const isDraftSave = body.status === 'draft'
  if (!isDraftSave && !complaint?.trim()) return NextResponse.json({ error: 'Concern description required' }, { status: 400 })

  // Duplicate WO prevention — skip for draft saves
  if (asset_id && !isDraftSave) {
    const { data: activeWOs } = await s.from('service_orders')
      .select('id, so_number')
      .eq('asset_id', asset_id)
      .eq('shop_id', shop_id)
      .is('deleted_at', null)
      .not('status', 'in', '("good_to_go","done","void")')
      .not('so_number', 'like', 'DRAFT-%')
      .limit(1)
    if (activeWOs && activeWOs.length > 0) {
      return NextResponse.json({ error: `Active WO exists: ${activeWOs[0].so_number}`, wo_number: activeWOs[0].so_number, wo_id: activeWOs[0].id }, { status: 409 })
    }
  }

  // Snapshot ownership_type from asset
  let assetOwnership = 'fleet_asset'
  let assetUnitNumber = ''
  if (asset_id) {
    const { data: assetData } = await s.from('assets').select('ownership_type, unit_number, is_owner_operator').eq('id', asset_id).single()
    if (assetData?.ownership_type) assetOwnership = assetData.ownership_type
    if (assetData?.is_owner_operator) assetOwnership = 'owner_operator'
    if (assetData?.unit_number) assetUnitNumber = assetData.unit_number
  }

  // Generate WO number + insert with retry on duplicate
  const { data: wo, error } = await insertServiceOrder(s, shop_id, {
    asset_id: asset_id || null,
    customer_id: customer_id || null,
    complaint: complaint?.trim() || '',
    source: 'walk_in',
    priority: priority || 'normal',
    status: body.status === 'submitted'
      ? (assetOwnership === 'fleet_asset' ? 'in_progress' : 'waiting_approval')
      : 'draft',
    submitted_at: body.submitted_at || null,
    advisor_id: user_id || null,
    service_writer_id: user_id || null,
    created_by_user_id: user_id || null,
    mileage_at_service: mileage ? parseInt(mileage) : null,
    odometer_in: mileage ? parseInt(mileage) : null,
    ownership_type: assetOwnership,
    job_type: job_type || 'repair',
    estimate_required: bodyEstimateRequired != null ? bodyEstimateRequired : (assetOwnership === 'owner_operator' || assetOwnership === 'outside_customer') && !['diagnostic', 'full_inspection'].includes(job_type || 'repair'),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mileage saved on WO only — truck odometer updates when WO closes

  // Create job lines — skip for draft saves
  const lines = isDraftSave ? [] : (job_lines || [complaint.trim()])
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineText = typeof line === 'string' ? line : line.description
    const lineSkills = typeof line === 'string' ? [] : (line.skills || [])
    if (!lineText?.trim()) continue
    await s.from('so_lines').insert({
      so_id: wo.id,
      line_type: 'labor',
      description: lineText.trim(),
      quantity: 0,
      unit_price: 0,
      line_status: 'unassigned',
      required_skills: lineSkills,
      tire_position: line.tire_position || null,
      customer_provides_parts: line.customer_provides_parts || false,
    })

    // Auto-insert rough parts for this job line
    const roughParts = line.rough_parts || []
    for (const rp of roughParts) {
      await s.from('so_lines').insert({
        so_id: wo.id,
        line_type: 'part',
        description: rp.rough_name || rp.description || '',
        rough_name: rp.rough_name || rp.description || '',
        quantity: rp.quantity || 1,
        unit_price: 0,
        parts_status: 'rough',
      })
    }
  }

  // Log activity
  await s.from('wo_activity_log').insert({
    wo_id: wo.id,
    user_id: user_id || null,
    action: isDraftSave ? `Saved draft work order ${wo.so_number}` : `Created work order ${wo.so_number}`,
  })

  // Fire and forget
  logAction({ shop_id, user_id, action: 'wo.created', entity_type: 'service_order', entity_id: wo.id, details: { so_number: wo.so_number } }).catch(() => {})

  // Notify service writers if estimate required — skip for draft saves
  if (wo.estimate_required && !isDraftSave) {
    try {
      const { createNotification, getUserIdsByRole } = await import('@/lib/createNotification')
      const writers = await getUserIdsByRole(shop_id, ['service_writer', 'service_advisor'])
      const unitNum = assetUnitNumber
      await createNotification({
        shopId: shop_id, recipientId: writers, type: 'estimate_required',
        title: 'Estimate Required', body: `WO ${wo.so_number} #${unitNum} — build and send estimate before work begins`,
        link: `/work-orders/${wo.id}`, relatedWoId: wo.id, relatedUnit: unitNum, priority: 'high',
      })
    } catch {}
  }

  return NextResponse.json(wo, { status: 201 })
}

export async function DELETE(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  if (!['owner', 'gm', 'it_person'].includes(actor.role)) {
    return NextResponse.json({ error: 'Only owner, GM, or IT can bulk delete' }, { status: 403 })
  }

  const s = db()
  const body = await req.json()
  const { ids } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  // Get WOs to check status
  const { data: wos } = await s.from('service_orders').select('id, status, so_number, shop_id').in('id', ids)
  if (!wos) return NextResponse.json({ error: 'Failed to fetch work orders' }, { status: 500 })

  const blocked = ['in_progress', 'completed', 'good_to_go', 'done', 'invoiced']
  const deletable = wos.filter(w => !blocked.includes(w.status))
  const skipped = wos.filter(w => blocked.includes(w.status))

  // Soft delete allowed ones
  const now = new Date().toISOString()
  if (deletable.length > 0) {
    await s.from('service_orders')
      .update({ deleted_at: now, updated_at: now })
      .in('id', deletable.map(w => w.id))
  }

  // Log
  if (deletable.length > 0) {
    const { logAction } = await import('@/lib/services/auditLog')
    logAction({ shop_id: shopId, user_id: actor.id, action: 'bulk_delete', entity_type: 'service_order', entity_id: ids.join(','), details: { count: deletable.length } }).catch(() => {})
  }

  return NextResponse.json({
    deleted: deletable.length,
    skipped: skipped.length,
    errors: skipped.map(w => `${w.so_number} cannot be deleted (status: ${w.status})`),
  })
}
