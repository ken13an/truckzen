import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

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
  }
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shop_id = getActorShopId(actor)
  if (!shop_id) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { rows } = await req.json()

  if (!rows) return NextResponse.json({ error: 'rows required' }, { status: 400 })
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS})` }, { status: 400 })

  const { data: customers } = await s.from('customers').select('id, company_name').eq('shop_id', shop_id)
  const custList = customers || []

  const { data: existingAssets } = await s.from('assets').select('unit_number').eq('shop_id', shop_id)
  const existingUnits = new Set((existingAssets || []).map((a: any) => a.unit_number?.toLowerCase()))

  // Duplicate detection within file
  const seenUnits = new Set<string>()
  const duplicateUnits = new Set<string>()
  for (const row of rows) {
    const u = row.unit_number?.trim?.()?.toLowerCase()
    if (!u) continue
    if (seenUnits.has(u)) duplicateUnits.add(u)
    seenUnits.add(u)
  }

  const results: any[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const r = normalizeRow(row)
    const issues: string[] = []
    let status: 'valid' | 'warning' | 'error' = 'valid'
    let customerMatch: any = null

    // Required: unit_number
    if (!r.unit_number) {
      issues.push('Missing unit number')
      status = 'error'
    }

    // Required: customer_name
    if (!r.customer_name) {
      issues.push('Missing customer name')
      status = 'error'
    }

    // Required: type with strict enum
    if (!r.type) {
      issues.push('Missing type')
      status = 'error'
    } else if (!TYPE_MAP[r.type]) {
      issues.push(`Invalid type "${r.type}"`)
      status = 'error'
    }

    // Duplicate unit_number within file
    if (r.unit_number && duplicateUnits.has(r.unit_number.toLowerCase())) {
      issues.push('Duplicate unit_number in file')
      status = 'error'
    }

    // VIN validation
    if (r.vin) {
      if (r.vin.length !== 17) {
        issues.push('VIN must be exactly 17 characters')
        status = 'error'
      }
    }

    // Year validation
    if (r.year !== null) {
      if (isNaN(r.year) || r.year < 1980 || r.year > new Date().getFullYear() + 1) {
        issues.push('Invalid year')
        status = 'error'
      }
    }

    // Customer matching
    if (r.customer_name) {
      const name = r.customer_name
      const exact = custList.find((c: any) => c.company_name?.toLowerCase() === name.toLowerCase())
      if (exact) {
        customerMatch = { id: exact.id, name: exact.company_name, type: 'exact' }
      } else {
        let bestMatch: any = null, bestScore = 0
        for (const c of custList) {
          if (!c.company_name) continue
          const score = similarity(name, c.company_name)
          if (score > bestScore) { bestScore = score; bestMatch = c }
        }
        if (bestScore >= 0.92) {
          customerMatch = { id: bestMatch.id, name: bestMatch.company_name, type: 'fuzzy', score: Math.round(bestScore * 100) }
          if (status !== 'error') status = 'warning'
          issues.push(`Customer auto-matched: "${name}" → "${bestMatch.company_name}" (${Math.round(bestScore * 100)}%)`)
        } else if (bestScore >= 0.5) {
          customerMatch = { id: bestMatch.id, name: bestMatch.company_name, type: 'suggested', score: Math.round(bestScore * 100) }
          if (status !== 'error') status = 'warning'
          issues.push(`Customer not found: "${name}". Did you mean "${bestMatch.company_name}"?`)
        } else {
          issues.push('Customer not found (will create new)')
          if (status !== 'error') status = 'warning'
        }
      }
    }

    // Existing unit check
    if (r.unit_number && existingUnits.has(r.unit_number.toLowerCase())) {
      issues.push('Unit number already exists (will update)')
      if (status === 'valid') status = 'warning'
    }

    results.push({ row_index: i, row, normalized: r, status, issues, customer_match: customerMatch })
  }

  const validCount = results.filter(r => r.status === 'valid' || r.status === 'warning').length
  const errorCount = results.filter(r => r.status === 'error').length

  return NextResponse.json({ results, valid_count: validCount, error_count: errorCount })
}
