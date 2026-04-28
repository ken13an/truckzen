import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rateLimit'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { deriveWOAutomation } from '@/lib/wo-automation'
import {
  createWorkOrderFromCanonicalInput,
  type CanonicalJobLineInput,
} from '@/lib/services/workOrderCreation'
import { safeRoute } from '@/lib/api-handler'
import { z } from 'zod'

// Schemas scoped to this route. Do not invent enum allowlists for priority /
// job_type — no canonical constant exists and business truth belongs
// elsewhere. Shape + length only.
const JobLineSchema = z.union([
  z.string().max(1000),
  z.object({
    description: z.string().min(1).max(1000),
    skills: z.array(z.string().max(64)).optional(),
    estimated_hours: z.union([z.number(), z.string()]).optional().nullable(),
    // May contain multiple selected positions joined by ", " — single field
    // matches so_lines.tire_position storage and the merge-route split/rejoin
    // contract in /api/so-lines/merge.
    tire_position: z.string().max(512).optional().nullable(),
    customer_provides_parts: z.boolean().optional(),
    rough_parts: z.array(z.object({
      rough_name: z.string().max(500).optional(),
      description: z.string().max(500).optional(),
      quantity: z.union([z.number(), z.string()]).optional(),
    }).passthrough()).optional(),
  }).passthrough(),
])

const WoPostSchema = z.object({
  asset_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  complaint: z.string().max(5000).optional().nullable(),
  priority: z.string().max(32).optional().nullable(),
  job_type: z.string().max(64).optional().nullable(),
  job_lines: z.array(JobLineSchema).max(200).optional(),
  mileage: z.union([z.number(), z.string()]).optional().nullable(),
  status: z.string().max(32).optional(),
  submitted_at: z.string().datetime().optional().nullable(),
  estimate_required: z.boolean().optional().nullable(),
}).strip()

const WoDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
}).strip()

function badInput(zErr: z.ZodError) {
  return NextResponse.json({ error: 'Invalid payload', issues: zErr.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, { status: 400 })
}

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

async function _POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shop_id = getActorShopId(actor)
  if (!shop_id) return jsonError('No shop context', 400)
  const user_id = actor.id

  const s = db()
  const raw = await req.json().catch(() => null)
  if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const parsed = WoPostSchema.safeParse(raw)
  if (!parsed.success) return badInput(parsed.error)
  const body = parsed.data
  const { asset_id, customer_id, complaint, priority, job_lines, mileage, job_type, estimate_required: bodyEstimateRequired } = body
  const isDraftSave = body.status === 'draft'
  if (!isDraftSave && !complaint?.trim()) return NextResponse.json({ error: 'Concern description required' }, { status: 400 })

  // Cross-shop FK guard: customer_id from body must belong to actor's shop.
  if (customer_id) {
    const { data: c } = await s.from('customers').select('shop_id').eq('id', customer_id).maybeSingle()
    if (!c || c.shop_id !== shop_id) return NextResponse.json({ error: 'Invalid customer_id' }, { status: 400 })
  }

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
    const { data: assetData } = await s.from('assets').select('shop_id, ownership_type, unit_number, is_owner_operator').eq('id', asset_id).single()
    // Cross-shop FK guard: asset must belong to actor's shop.
    if (!assetData || assetData.shop_id !== shop_id) return NextResponse.json({ error: 'Invalid asset_id' }, { status: 400 })
    if (assetData.ownership_type) assetOwnership = assetData.ownership_type
    if (assetData.is_owner_operator) assetOwnership = 'owner_operator'
    if (assetData.unit_number) assetUnitNumber = assetData.unit_number
  }

  // Hand off to the canonical WO creation service. The route's job ends with
  // the request-shape concerns above (auth, Zod, FK guards, duplicate guard,
  // ownership snapshot). Everything from here — WO numbering, so_lines insert,
  // labor-hour defaults, rough-parts inventory match, fallback part, line
  // invariant + rollback, wo_activity_log, wo.created audit, estimate-required
  // notification — lives in src/lib/services/workOrderCreation.ts and is
  // shared with the Pending Request adapter.
  const status = body.status === 'submitted'
    ? (assetOwnership === 'fleet_asset' ? 'in_progress' : 'waiting_approval')
    : 'draft'
  const estimateRequired = bodyEstimateRequired != null
    ? bodyEstimateRequired
    : (assetOwnership === 'owner_operator' || assetOwnership === 'outside_customer')
        && !['diagnostic', 'full_inspection'].includes(job_type || 'repair')

  // Empty body.job_lines falls back to a single line built from the complaint
  // text. Empty descriptions are skipped inside the service.
  const rawLines: Array<string | { [k: string]: any }> = isDraftSave
    ? []
    : (job_lines && job_lines.length > 0 ? job_lines : [(complaint || '').trim()])
  const canonicalJobLines: CanonicalJobLineInput[] = rawLines.map((line: any) => {
    if (typeof line === 'string') {
      return { description: line }
    }
    const explicitHours = line.estimated_hours != null
      ? Number(parseFloat(String(line.estimated_hours)))
      : null
    return {
      description: String(line.description || ''),
      estimated_hours: (explicitHours !== null && !Number.isNaN(explicitHours)) ? explicitHours : null,
      required_skills: line.skills || [],
      tire_position: line.tire_position || null,
      customer_provides_parts: !!line.customer_provides_parts,
      rough_parts: Array.isArray(line.rough_parts) ? line.rough_parts : [],
    }
  })

  const result = await createWorkOrderFromCanonicalInput(s, shop_id, user_id, {
    asset_id: asset_id || null,
    customer_id: customer_id || null,
    complaint: complaint?.trim() || '',
    source: 'walk_in',
    priority: priority || 'normal',
    status,
    submitted_at: body.submitted_at || null,
    advisor_id: user_id || null,
    service_writer_id: user_id || null,
    created_by_user_id: user_id || null,
    mileage_at_service: mileage ? parseInt(String(mileage)) : null,
    odometer_in: mileage ? parseInt(String(mileage)) : null,
    ownership_type: assetOwnership,
    job_type: job_type || 'repair',
    estimate_required: estimateRequired,
    asset_unit_number: assetUnitNumber || null,
  }, canonicalJobLines, {
    isDraftSave,
    notifyEstimateRequired: true,
  })

  if (!result.ok) {
    const body: Record<string, unknown> = { error: result.error }
    if (result.rollback) body.rollback = result.rollback
    return NextResponse.json(body, { status: result.status })
  }

  return NextResponse.json(result.wo, { status: 201 })
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
  const raw = await req.json().catch(() => null)
  if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const parsed = WoDeleteSchema.safeParse(raw)
  if (!parsed.success) return badInput(parsed.error)
  const { ids } = parsed.data

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
