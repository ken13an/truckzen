import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

// Simple string similarity (Dice coefficient)
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

// POST /api/smart-import/trucks/preview — validate rows and return issues
export async function POST(req: Request) {
  const s = db()
  const { rows, shop_id } = await req.json()

  if (!rows || !shop_id) return NextResponse.json({ error: 'rows and shop_id required' }, { status: 400 })

  // Fetch all existing customers for matching
  const { data: customers } = await s.from('customers').select('id, company_name').eq('shop_id', shop_id)
  const custList = customers || []

  // Fetch existing unit numbers
  const { data: existingAssets } = await s.from('assets').select('unit_number').eq('shop_id', shop_id)
  const existingUnits = new Set((existingAssets || []).map((a: any) => a.unit_number?.toLowerCase()))

  const results: any[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const issues: string[] = []
    let status: 'valid' | 'warning' | 'error' = 'valid'
    let customerMatch: any = null

    // Required field checks
    if (!row.unit_number?.trim()) {
      issues.push('Missing unit number (required)')
      status = 'error'
    }

    if (!row.type?.trim() && !row.unit_type?.trim()) {
      issues.push('Missing type (required — Tractor or Trailer)')
      status = 'error'
    } else {
      const t = (row.type || row.unit_type || '').toLowerCase().trim()
      if (!['tractor', 'trailer', 'straight truck', 'box truck', 'reefer', 'flatbed', 'tanker', 'other'].includes(t)) {
        issues.push(`Invalid type "${row.type || row.unit_type}" — must be Tractor or Trailer`)
        status = 'error'
      }
    }

    // Customer name matching
    if (!row.customer_name?.trim()) {
      issues.push('Missing customer name (required)')
      status = 'error'
    } else {
      const name = row.customer_name.trim()

      // 1. Exact match (case-insensitive)
      const exact = custList.find((c: any) => c.company_name?.toLowerCase() === name.toLowerCase())
      if (exact) {
        customerMatch = { id: exact.id, name: exact.company_name, type: 'exact' }
      } else {
        // 2. Fuzzy match
        let bestMatch: any = null
        let bestScore = 0
        for (const c of custList) {
          if (!c.company_name) continue
          const score = similarity(name, c.company_name)
          if (score > bestScore) { bestScore = score; bestMatch = c }
        }

        if (bestScore >= 0.85) {
          customerMatch = { id: bestMatch.id, name: bestMatch.company_name, type: 'fuzzy', score: Math.round(bestScore * 100) }
          if (status !== 'error') status = 'warning'
          issues.push(`Customer auto-matched: "${name}" → "${bestMatch.company_name}" (${Math.round(bestScore * 100)}%)`)
        } else if (bestScore >= 0.5) {
          customerMatch = { id: bestMatch.id, name: bestMatch.company_name, type: 'suggested', score: Math.round(bestScore * 100) }
          status = 'error'
          issues.push(`Customer not found: "${name}". Did you mean "${bestMatch.company_name}"?`)
        } else {
          status = 'error'
          issues.push(`Customer not found: "${name}". No close match found.`)
        }
      }
    }

    // VIN validation
    if (row.vin?.trim()) {
      const vin = row.vin.trim().replace(/[^A-HJ-NPR-Z0-9]/gi, '')
      if (vin.length !== 17) {
        issues.push(`Invalid VIN length (${vin.length} chars, must be 17)`)
        if (status !== 'error') status = 'warning'
      }
    }

    // Duplicate unit check
    if (row.unit_number?.trim() && existingUnits.has(row.unit_number.trim().toLowerCase())) {
      issues.push('Unit number already exists (will update)')
      if (status === 'valid') status = 'warning'
    }

    results.push({
      row_index: i,
      row,
      status,
      issues,
      customer_match: customerMatch,
    })
  }

  const validCount = results.filter(r => r.status === 'valid' || r.status === 'warning').length
  const errorCount = results.filter(r => r.status === 'error').length

  return NextResponse.json({ results, valid_count: validCount, error_count: errorCount })
}
