import { NextResponse } from 'next/server'
import { checkPortalLimits } from '@/lib/ratelimit/portal-guard'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
type P = { params: Promise<{ token: string }> }

export async function POST(req: Request, { params }: P) {
  const { token } = await params
  const _rl = await checkPortalLimits(req, token); if (_rl !== true) return _rl
  const s = db()
  // Phase 4: optional supplement_batch_id narrows the approval to one batch.
  // Optional line_ids for explicit per-line approval still works (backward compat).
  const body = await req.json().catch(() => ({}))
  const { line_ids, supplement_batch_id } = body as { line_ids?: string[]; supplement_batch_id?: string }

  const { data: wo } = await s.from('service_orders').select('id').eq('portal_token', token).single()
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  const approvedLineIds: string[] = []
  const approvedPartIds: string[] = []

  if (Array.isArray(line_ids) && line_ids.length > 0) {
    // Explicit list: keep existing per-line behavior (so_lines only).
    for (const lid of line_ids) {
      const { data } = await s.from('so_lines').update({ customer_approved: true, approved_at: now }).eq('id', lid).eq('so_id', wo.id).select('id').maybeSingle()
      if (data?.id) approvedLineIds.push(data.id)
    }
  } else if (supplement_batch_id) {
    // Batch scope: approve every pending additional line and part in this batch.
    const { data: upLines } = await s.from('so_lines').update({ customer_approved: true, approved_at: now })
      .eq('so_id', wo.id).eq('is_additional', true).is('customer_approved', null).eq('supplement_batch_id', supplement_batch_id)
      .select('id')
    const { data: upParts } = await s.from('wo_parts').update({ customer_approved: true, approved_at: now })
      .eq('wo_id', wo.id).eq('is_additional', true).is('customer_approved', null).eq('supplement_batch_id', supplement_batch_id)
      .select('id')
    for (const r of upLines || []) approvedLineIds.push((r as any).id)
    for (const r of upParts || []) approvedPartIds.push((r as any).id)
  } else {
    // No scope: approve all pending additional lines AND wo_parts on this WO.
    const { data: upLines } = await s.from('so_lines').update({ customer_approved: true, approved_at: now })
      .eq('so_id', wo.id).eq('is_additional', true).is('customer_approved', null)
      .select('id')
    const { data: upParts } = await s.from('wo_parts').update({ customer_approved: true, approved_at: now })
      .eq('wo_id', wo.id).eq('is_additional', true).is('customer_approved', null)
      .select('id')
    for (const r of upLines || []) approvedLineIds.push((r as any).id)
    for (const r of upParts || []) approvedPartIds.push((r as any).id)
  }

  await s.from('wo_activity_log').insert({
    wo_id: wo.id,
    action: 'Customer approved supplement items via portal',
    details: {
      event: 'supplement_approved',
      wo_id: wo.id,
      approved_line_ids: approvedLineIds,
      approved_part_ids: approvedPartIds,
      supplement_batch_id: supplement_batch_id || null,
    },
  })

  return NextResponse.json({ ok: true, approved_lines: approvedLineIds.length, approved_parts: approvedPartIds.length })
}
