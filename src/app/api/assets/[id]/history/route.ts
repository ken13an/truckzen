import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: assetId } = await params
  const { searchParams } = new URL(req.url)
  const source = searchParams.get('source') || 'all'
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  // Build UNION ALL query for both sources
  let conditions = ''
  const queryParams: any[] = [assetId, user.shop_id]
  let paramIdx = 3

  if (search) {
    conditions = `AND (description ILIKE $${paramIdx} OR reference_number ILIKE $${paramIdx} OR assigned_to ILIKE $${paramIdx})`
    queryParams.push(`%${search}%`)
    paramIdx++
  }

  const inhouseCTE = `
    SELECT
      so.id,
      so.so_number AS reference_number,
      COALESCE(so.completed_at, so.created_at) AS date,
      so.status::text,
      so.complaint AS description,
      so.grand_total AS total_cost,
      'inhouse' AS source,
      COALESCE(u.full_name, '') AS assigned_to,
      c.company_name AS customer_name
    FROM service_orders so
    LEFT JOIN users u ON so.assigned_tech = u.id
    LEFT JOIN customers c ON so.customer_id = c.id
    WHERE so.asset_id = $1
      AND so.shop_id = $2
      AND so.deleted_at IS NULL
  `

  const outsideCTE = `
    SELECT
      rr.id,
      rr.repair_number AS reference_number,
      COALESCE(rr.repair_date::timestamptz, rr.created_at) AS date,
      rr.status::text,
      rr.description,
      rr.total_cost,
      'outside' AS source,
      COALESCE(v.name, '') AS assigned_to,
      NULL AS customer_name
    FROM maint_road_repairs rr
    LEFT JOIN maint_vendors v ON rr.vendor_id = v.id
    WHERE rr.asset_id = $1
      AND rr.shop_id = $2
  `

  let dataQuery = ''
  if (source === 'inhouse') {
    dataQuery = inhouseCTE
  } else if (source === 'outside') {
    dataQuery = outsideCTE
  } else {
    dataQuery = `${inhouseCTE} UNION ALL ${outsideCTE}`
  }

  // Wrap in CTE for filtering, sorting, pagination
  const fullQuery = `
    WITH history AS (${dataQuery})
    SELECT * FROM history
    WHERE 1=1 ${conditions}
    ORDER BY date DESC NULLS LAST
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `
  queryParams.push(limit, offset)

  // Count query
  const countQuery = `
    WITH history AS (${dataQuery})
    SELECT COUNT(*)::int AS total FROM history
    WHERE 1=1 ${conditions}
  `
  // Count params are same minus limit/offset
  const countParams = queryParams.slice(0, -2)

  // Summary query — always unfiltered
  const summaryQuery = `
    SELECT
      (SELECT COUNT(*)::int FROM service_orders WHERE asset_id = $1 AND shop_id = $2 AND deleted_at IS NULL) AS inhouse_count,
      (SELECT COALESCE(SUM(grand_total), 0)::float FROM service_orders WHERE asset_id = $1 AND shop_id = $2 AND deleted_at IS NULL) AS inhouse_total,
      (SELECT COUNT(*)::int FROM maint_road_repairs WHERE asset_id = $1 AND shop_id = $2) AS outside_count,
      (SELECT COALESCE(SUM(total_cost), 0)::float FROM maint_road_repairs WHERE asset_id = $1 AND shop_id = $2) AS outside_total
  `

  try {
    const [dataRes, countRes, summaryRes] = await Promise.all([
      supabase.rpc('exec_sql', { query: fullQuery, params: queryParams }).single(),
      supabase.rpc('exec_sql', { query: countQuery, params: countParams }).single(),
      supabase.rpc('exec_sql', { query: summaryQuery, params: [assetId, user.shop_id] }).single(),
    ])

    // If RPC not available, fall back to separate Supabase queries
    if (dataRes.error) throw new Error('rpc_unavailable')

    return NextResponse.json({
      data: dataRes.data,
      total: (countRes.data as any)?.total ?? 0,
      summary: summaryRes.data,
      page,
      limit,
    })
  } catch {
    // Fallback: query each table separately via Supabase client
    const [soRes, rrRes] = await Promise.all([
      source !== 'outside'
        ? supabase
            .from('service_orders')
            .select('id, so_number, status, complaint, grand_total, completed_at, created_at, assigned_tech, customer_id')
            .eq('asset_id', assetId)
            .eq('shop_id', user.shop_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      source !== 'inhouse'
        ? supabase
            .from('maint_road_repairs')
            .select('id, repair_number, status, description, total_cost, repair_date, created_at, vendor_id')
            .eq('asset_id', assetId)
            .eq('shop_id', user.shop_id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])

    // Get tech names and vendor names for display
    const soData = soRes.data || []
    const rrData = rrRes.data || []

    const techIds = [...new Set(soData.filter(s => s.assigned_tech).map(s => s.assigned_tech))]
    const vendorIds = [...new Set(rrData.filter(r => r.vendor_id).map(r => r.vendor_id))]
    const customerIds = [...new Set(soData.filter(s => s.customer_id).map(s => s.customer_id))]

    const [techRes, vendorRes, custRes] = await Promise.all([
      techIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', techIds) : Promise.resolve({ data: [] }),
      vendorIds.length > 0 ? supabase.from('maint_vendors').select('id, name').in('id', vendorIds) : Promise.resolve({ data: [] }),
      customerIds.length > 0 ? supabase.from('customers').select('id, company_name').in('id', customerIds) : Promise.resolve({ data: [] }),
    ])

    const techMap = Object.fromEntries((techRes.data || []).map(t => [t.id, t.full_name]))
    const vendorMap = Object.fromEntries((vendorRes.data || []).map(v => [v.id, v.name]))
    const custMap = Object.fromEntries((custRes.data || []).map(c => [c.id, c.company_name]))

    // Normalize into unified format
    const inhouseRows = soData.map(so => ({
      id: so.id,
      reference_number: so.so_number,
      date: so.completed_at || so.created_at,
      status: so.status,
      description: so.complaint,
      total_cost: so.grand_total,
      source: 'inhouse' as const,
      assigned_to: techMap[so.assigned_tech] || '',
      customer_name: custMap[so.customer_id] || null,
    }))

    const outsideRows = rrData.map(rr => ({
      id: rr.id,
      reference_number: rr.repair_number,
      date: rr.repair_date || rr.created_at,
      status: rr.status,
      description: rr.description,
      total_cost: rr.total_cost,
      source: 'outside' as const,
      assigned_to: vendorMap[rr.vendor_id] || '',
      customer_name: null,
    }))

    let combined = [...inhouseRows, ...outsideRows]
    combined.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())

    // Apply search filter
    if (search) {
      const s = search.toLowerCase()
      combined = combined.filter(r =>
        (r.description || '').toLowerCase().includes(s) ||
        (r.reference_number || '').toLowerCase().includes(s) ||
        (r.assigned_to || '').toLowerCase().includes(s)
      )
    }

    const total = combined.length
    const paged = combined.slice(offset, offset + limit)

    const inhouseTotal = soData.reduce((sum, s) => sum + (s.grand_total || 0), 0)
    const outsideTotal = rrData.reduce((sum, r) => sum + (r.total_cost || 0), 0)

    return NextResponse.json({
      data: paged,
      total,
      summary: {
        inhouse_count: soData.length,
        inhouse_total: inhouseTotal,
        outside_count: rrData.length,
        outside_total: outsideTotal,
      },
      page,
      limit,
    })
  }
}
