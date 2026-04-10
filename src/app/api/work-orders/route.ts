import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAction } from '@/lib/services/auditLog'
import { checkRateLimit } from '@/lib/rateLimit'
import { insertServiceOrder } from '@/lib/generateWoNumber'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { deriveWOAutomation } from '@/lib/wo-automation'
import { getDefaultLaborHours } from '@/lib/labor-hours'
import { isDiagnosticJob } from '@/lib/parts-suggestions'
import { safeRoute } from '@/lib/api-handler'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function _GET(req: Request) {
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
  if (historical === 'false') {
    q = q.or('is_historical.is.null,is_historical.eq.false')
    // Exclude picked-up/voided WOs from Active view (done stays — in accounting review)
    q = q.not('status', 'in', '("good_to_go","void")')
  }
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

/** Rollback a just-created WO: delete children then header, verify cleanup, log result */
async function rollbackNewWO(s: any, woId: string, woNumber: string, reason: string): Promise<{ clean: boolean }> {
  let childDeleteOk = true
  let headerDeleteOk = true
  let verified = false

  // Step 1: delete child so_lines
  const { error: childErr } = await s.from('so_lines').delete().eq('so_id', woId)
  if (childErr) {
    console.error(`[WO ${woNumber}] ROLLBACK: failed to delete child so_lines:`, childErr.message)
    childDeleteOk = false
  }

  // Step 2: delete WO header
  const { error: headerErr } = await s.from('service_orders').delete().eq('id', woId)
  if (headerErr) {
    console.error(`[WO ${woNumber}] ROLLBACK: failed to delete WO header:`, headerErr.message)
    headerDeleteOk = false
  }

  // Step 3: verify cleanup — check if header still exists
  if (childDeleteOk && headerDeleteOk) {
    const { data: check } = await s.from('service_orders').select('id').eq('id', woId).maybeSingle()
    verified = !check
    if (check) {
      console.error(`[WO ${woNumber}] ROLLBACK VERIFICATION FAILED: WO header still exists after delete`)
    }
  }

  const clean = childDeleteOk && headerDeleteOk && verified
  console.error(`[WO ${woNumber}] ROLLBACK ${clean ? 'SUCCESS' : 'PARTIAL/FAILED'}: reason=${reason}, childDelete=${childDeleteOk}, headerDelete=${headerDeleteOk}, verified=${verified}`)
  return { clean }
}

async function _POST(req: Request) {
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
  // Guard: empty array must fall back to complaint ([] is truthy in JS)
  const lines = isDraftSave ? [] : (job_lines && job_lines.length > 0 ? job_lines : [complaint.trim()])
  let laborLinesCreated = 0
  try {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineText = typeof line === 'string' ? line : line.description
    const lineSkills = typeof line === 'string' ? [] : (line.skills || [])
    if (!lineText?.trim()) continue
    // Labor hours: use explicit value from frontend, else fallback lookup, else null (mechanic uses Request Hours)
    const explicitHours = typeof line === 'object' && line.estimated_hours ? parseFloat(line.estimated_hours) : null
    const lineEstimatedHours = explicitHours || getDefaultLaborHours(lineText.trim())
    const { data: laborLine } = await s.from('so_lines').insert({
      so_id: wo.id,
      line_type: 'labor',
      description: lineText.trim(),
      quantity: 0,
      unit_price: 0,
      estimated_hours: lineEstimatedHours,
      line_status: 'unassigned',
      required_skills: lineSkills,
      tire_position: line.tire_position || null,
      customer_provides_parts: line.customer_provides_parts || false,
    }).select('id').single()
    const laborLineId = laborLine?.id || null
    if (laborLineId) laborLinesCreated++

    // Auto-insert rough parts for this job line — check inventory first
    const roughParts = line.rough_parts || []
    let partsCreated = 0
    for (const rp of roughParts) {
      const partName = rp.rough_name || rp.description || ''
      if (!partName) continue

      // Try to match against shop inventory — conservative match only
      const { data: invMatch } = await s.from('parts')
        .select('id, description, part_number, cost_price, sell_price, on_hand')
        .eq('shop_id', shop_id)
        .is('deleted_at', null)
        .ilike('description', `%${partName}%`)
        .gt('on_hand', 0)
        .limit(5)

      // Conservative component-level match: only auto-confirm when inventory is the SAME component
      // Reject sibling/subcomponent matches (e.g. "Windshield Seal" for "Windshield", "Door Mirror" for "Door")
      const partWords = partName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
      const inv = (invMatch || []).find((item: any) => {
        const invWords: string[] = (item.description || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
        // All requested words must be present in inventory description
        if (!partWords.every((w: string) => invWords.some((iw: string) => iw === w || iw === w + 's' || iw + 's' === w))) return false
        // Inventory must not have significant extra nouns that change the component identity
        // Allow generic suffixes: assembly, kit, set, oem, aftermarket, heavy duty
        const safeExtras = new Set(['assembly', 'assy', 'kit', 'set', 'oem', 'aftermarket', 'heavy', 'duty', 'hd', 'lh', 'rh', 'left', 'right', 'front', 'rear', 'new', 'replacement'])
        const extraWords = invWords.filter((w: string) => !partWords.includes(w) && !partWords.some((pw: string) => w === pw + 's' || w + 's' === pw))
        const unsafeExtras = extraWords.filter((w: string) => !safeExtras.has(w))
        return unsafeExtras.length === 0
      }) || null

      await s.from('so_lines').insert({
        so_id: wo.id,
        line_type: 'part',
        description: partName,
        rough_name: partName,
        real_name: inv ? inv.description : null,
        part_number: inv ? inv.part_number : null,
        quantity: rp.quantity || 1,
        unit_price: inv ? (inv.sell_price || 0) : 0,
        parts_cost_price: inv ? (inv.cost_price || 0) : null,
        parts_sell_price: inv ? (inv.sell_price || 0) : null,
        parts_status: 'rough',
        related_labor_line_id: laborLineId,
      })
      partsCreated++
    }

    // Simple parts rule: if non-diagnostic job has no auto-parts, create rough placeholder
    if (partsCreated === 0 && !isDiagnosticJob(lineText.trim())) {
      const roughName = lineText.trim().replace(/^(replace|install|swap|new)\s+/i, '').trim() || lineText.trim()
      await s.from('so_lines').insert({
        so_id: wo.id, line_type: 'part', description: roughName, rough_name: roughName,
        quantity: 1, unit_price: 0, parts_status: 'rough', related_labor_line_id: laborLineId,
      })
    }
  }

  // ══ INVARIANT: at least one labor/job line must be persisted for non-draft WOs ══
  if (!isDraftSave && laborLinesCreated === 0) {
    const rb = await rollbackNewWO(s, wo.id, wo.so_number, 'zero labor lines created')
    return NextResponse.json({ error: 'Failed to create job lines. Work order was not saved. Please try again.', rollback: rb.clean ? 'clean' : 'partial' }, { status: 500 })
  }

  } catch (childErr: unknown) {
    const errMsg = childErr instanceof Error ? childErr.message : String(childErr)
    const rb = await rollbackNewWO(s, wo.id, wo.so_number, `child creation threw: ${errMsg}`)
    return NextResponse.json({ error: 'Failed to create work order lines. Please try again.', rollback: rb.clean ? 'clean' : 'partial' }, { status: 500 })
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

async function _DELETE(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  if (!['owner', 'gm', 'it_person', 'service_writer'].includes(actor.role)) {
    return NextResponse.json({ error: 'Only owner, GM, IT, or service writer can void work orders' }, { status: 403 })
  }

  const s = db()
  const body = await req.json()
  const { ids } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  // Get WOs — shop-scoped. Void is allowed from any status.
  const { data: wos } = await s.from('service_orders').select('id, status, so_number, shop_id').in('id', ids).eq('shop_id', shopId)
  if (!wos) return NextResponse.json({ error: 'Failed to fetch work orders' }, { status: 500 })

  // Soft void all selected WOs
  const now = new Date().toISOString()
  if (wos.length > 0) {
    await s.from('service_orders')
      .update({ deleted_at: now, status: 'void', updated_at: now })
      .in('id', wos.map(w => w.id))
  }

  // Log
  if (wos.length > 0) {
    const { logAction } = await import('@/lib/services/auditLog')
    logAction({ shop_id: shopId, user_id: actor.id, action: 'bulk_void', entity_type: 'service_order', entity_id: ids.join(','), details: { count: wos.length, previous_statuses: wos.map(w => `${w.so_number}:${w.status}`) } }).catch(() => {})
  }

  return NextResponse.json({
    voided: wos.length,
    skipped: 0,
    errors: [],
  })
}

export const GET = safeRoute(_GET)
export const POST = safeRoute(_POST)
export const DELETE = safeRoute(_DELETE)
