import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'
import { refreshEstimateSnapshot } from '@/lib/estimates/snapshotRefresh'
import { z } from 'zod'

// POST /api/estimates/[id]/refresh
//
// Rebuilds estimate_lines + totals from current live so_lines + wo_parts.
// Refuses on terminal/locked states. Optimistic concurrency via
// expected_updated_at: callers must pass the estimate row's last-seen
// updated_at so a stale tab cannot wipe a snapshot that another writer
// just regenerated.

const Body = z.object({
  expected_updated_at: z.string().datetime({ offset: true }).optional().nullable(),
}).strip()

async function _POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRouteContext([...INVOICE_ACTION_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing estimate id' }, { status: 400 })

  const raw = await req.json().catch(() => ({}))
  const parsed = Body.safeParse(raw && typeof raw === 'object' ? raw : {})
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, { status: 400 })
  }

  // Shop scoping: confirm the estimate belongs to the actor's shop before
  // calling the helper. Helper does no shop check on its own.
  const { data: scoped } = await ctx.admin
    .from('estimates')
    .select('id, shop_id')
    .eq('id', id)
    .single()
  if (!scoped) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
  if (!ctx.actor.is_platform_owner && ctx.shopId && (scoped as any).shop_id !== ctx.shopId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await refreshEstimateSnapshot(ctx.admin, id, parsed.data.expected_updated_at ?? null)

  if (!result.ok) {
    const reason = result.reason || 'unknown'
    if (reason === 'estimate_not_found') return NextResponse.json({ ok: false, reason }, { status: 404 })
    if (reason === 'updated_at_mismatch') {
      return NextResponse.json({ ok: false, reason, message: 'This estimate was updated by someone else. Refresh and try again.' }, { status: 409 })
    }
    if (reason === 'estimate_approved' || reason === 'estimate_declined' || reason === 'wo_is_historical' || reason === 'wo_invoice_locked') {
      // Refusal — not an error. The page surfaces this as a non-blocking toast
      // so the live edit still succeeds; the customer-facing snapshot just
      // stays frozen.
      return NextResponse.json({ ok: false, reason, skipped: true }, { status: 200 })
    }
    return NextResponse.json({ ok: false, reason }, { status: 400 })
  }

  return NextResponse.json({ ok: true, inserted: result.inserted ?? 0, updated_at: result.updated_at ?? null })
}

export const POST = safeRoute(_POST as any)
