import { NextResponse } from 'next/server'
import { SERVICE_WRITE_ROLES } from '@/lib/roles'
import { requireRouteContext } from '@/lib/api-route-auth'
import { isInvoiceHardLocked } from '@/lib/invoice-lock'
import { mergePersistedDescriptions } from '@/lib/merge-lines'
import { safeRoute } from '@/lib/api-handler'

/**
 * POST /api/so-lines/merge
 * Merge persisted WO lines — service writer controlled.
 * Only untouched lines with no downstream activity can be merged.
 */
async function _POST(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_WRITE_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!

  const body = await req.json().catch(() => null)
  const destinationId = body?.destination_id
  const sourceIds: string[] = body?.source_ids
  if (!destinationId || !Array.isArray(sourceIds) || sourceIds.length === 0) {
    return NextResponse.json({ error: 'destination_id and source_ids[] required' }, { status: 400 })
  }
  if (sourceIds.includes(destinationId)) {
    return NextResponse.json({ error: 'Destination cannot be in source list' }, { status: 400 })
  }

  const s = ctx.admin
  const allIds = [destinationId, ...sourceIds]

  // Fetch all involved lines
  const { data: lines, error: linesErr } = await s.from('so_lines')
    .select('id, so_id, line_type, description, estimated_hours, required_skills, tire_position, customer_provides_parts')
    .in('id', allIds)
  if (linesErr || !lines || lines.length !== allIds.length) {
    return NextResponse.json({ error: 'One or more lines not found' }, { status: 404 })
  }

  // Verify all lines belong to the same WO
  const soId = lines[0].so_id
  if (!lines.every(l => l.so_id === soId)) {
    return NextResponse.json({ error: 'All lines must belong to the same work order' }, { status: 400 })
  }

  // Verify all are labor lines
  if (!lines.every(l => l.line_type === 'labor')) {
    return NextResponse.json({ error: 'Only labor/job lines can be merged' }, { status: 400 })
  }

  // Check WO is not historical or invoice-locked
  const { data: wo } = await s.from('service_orders').select('invoice_status, is_historical, shop_id').eq('id', soId).single()
  if (wo?.is_historical) {
    return NextResponse.json({ error: 'Historical records are read-only' }, { status: 403 })
  }
  if (isInvoiceHardLocked(wo?.invoice_status)) {
    return NextResponse.json({ error: 'Lines are locked — invoice has been sent' }, { status: 403 })
  }

  // Shop scope check
  const actorShopId = ctx.shopId
  if (wo?.shop_id !== actorShopId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Safety checks on source lines — block if any downstream activity exists
  const blocked: { id: string; reason: string }[] = []
  for (const srcId of sourceIds) {
    // Check assignments
    const { data: assignments } = await s.from('wo_job_assignments').select('id').eq('line_id', srcId).limit(1)
    if (assignments && assignments.length > 0) {
      blocked.push({ id: srcId, reason: 'Has mechanic assignments' })
      continue
    }

    // Check time entries
    const { data: timeEntries } = await s.from('so_time_entries').select('id').eq('so_line_id', srcId).is('deleted_at', null).limit(1)
    if (timeEntries && timeEntries.length > 0) {
      blocked.push({ id: srcId, reason: 'Has time clock records' })
      continue
    }

    // Check child parts (so_lines with related_labor_line_id pointing to this source)
    const { data: childParts } = await s.from('so_lines').select('id').eq('related_labor_line_id', srcId).limit(1)
    if (childParts && childParts.length > 0) {
      blocked.push({ id: srcId, reason: 'Has linked parts — remove or reassign parts first' })
      continue
    }
  }

  if (blocked.length > 0) {
    const reasons = blocked.map(b => {
      const line = lines.find(l => l.id === b.id)
      return `"${line?.description || b.id}": ${b.reason}`
    })
    return NextResponse.json({ error: 'Cannot merge — some lines have downstream activity', blocked: reasons }, { status: 409 })
  }

  // Execute merge: update destination, delete sources
  const destLine = lines.find(l => l.id === destinationId)!
  const srcLines = lines.filter(l => sourceIds.includes(l.id))
  const mergedDesc = mergePersistedDescriptions(destLine.description, srcLines.map(l => l.description))

  // Merge estimated_hours (sum)
  const totalHours = lines.reduce((sum, l) => sum + (l.estimated_hours || 0), 0)

  // Union skills
  const allSkills = new Set<string>()
  lines.forEach(l => (l.required_skills || []).forEach((sk: string) => allSkills.add(sk)))

  // Union tire positions
  const allPositions = new Set<string>()
  lines.forEach(l => {
    if (l.tire_position) l.tire_position.split(',').map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => allPositions.add(t))
  })

  // Update destination line
  await s.from('so_lines').update({
    description: mergedDesc,
    estimated_hours: totalHours > 0 ? totalHours : null,
    required_skills: allSkills.size > 0 ? Array.from(allSkills) : null,
    tire_position: allPositions.size > 0 ? Array.from(allPositions).join(', ') : null,
  }).eq('id', destinationId)

  // Delete source lines (canonical hard-delete pattern for so_lines)
  for (const srcId of sourceIds) {
    await s.from('so_lines').delete().eq('id', srcId)
  }

  // Log activity
  try {
    await s.from('wo_activity_log').insert({
      wo_id: soId,
      user_id: ctx.actor.id,
      action: `Merged ${sourceIds.length} job line${sourceIds.length > 1 ? 's' : ''} into "${mergedDesc.slice(0, 60)}"`,
    })
  } catch { /* activity log is non-critical */ }

  return NextResponse.json({ ok: true, merged_description: mergedDesc })
}

export const POST = safeRoute(_POST)
