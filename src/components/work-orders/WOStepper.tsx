'use client'

const BLUE = '#1D6FE8', GREEN = '#16A34A', GRAY = '#9CA3AF', AMBER = '#D97706'
const FONT = "'Inter', -apple-system, sans-serif"

interface WOStepperProps {
  wo: any
  asset: any
  jobLines: any[]
  jobAssignments: any[]
}

function formatDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return null
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function WOStepper({ wo, asset, jobLines, jobAssignments }: WOStepperProps) {
  const isNew = !!wo.submitted_at
  const isFleet = (asset?.ownership_type || wo.ownership_type) === 'fleet_asset'

  // NEW stepper for WOs with submitted_at
  if (isNew) {
    const hasSubmit = !!wo.submitted_at
    const skipEstimate = isFleet
    const hasEstimate = skipEstimate || !!wo.estimate_approved_at
    const estimatePending = !skipEstimate && !!wo.estimate_sent_at && !wo.estimate_approved_at

    const jobsAssigned = jobLines.filter((l: any) => jobAssignments.some((ja: any) => ja.line_id === l.id)).length
    const totalJobs = jobLines.length || 1
    const hasAssign = totalJobs > 0 && jobsAssigned >= totalJobs

    // Parts step: check part-type lines — canceled parts are resolved, not blockers
    const allPartLines = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
    const activePartLines = allPartLines.filter((l: any) => l.parts_status !== 'canceled')
    const partsReceived = activePartLines.filter((l: any) => ['received', 'ready_for_job', 'installed'].includes(l.parts_status)).length
    const noParts = activePartLines.length === 0
    const hasParts = noParts || partsReceived >= activePartLines.length

    const jobsComplete = jobLines.filter((l: any) => l.line_status === 'completed' || l.completed_at).length
    const hasRepair = totalJobs > 0 && jobsComplete >= totalJobs

    const hasInvoice = !!wo.invoiced_at || ['invoiced', 'closed'].includes(wo.status) || wo.invoice_status === 'sent_to_customer'

    const steps = [
      { label: 'Submit', done: hasSubmit, active: !hasSubmit, skip: false, duration: formatDuration(wo.created_at, wo.submitted_at), progress: null as string | null },
      { label: 'Estimate', done: hasEstimate, active: hasSubmit && !hasEstimate, skip: skipEstimate, duration: skipEstimate ? null : formatDuration(wo.submitted_at, wo.estimate_approved_at), progress: estimatePending ? 'Pending' : null },
      { label: 'Assign', done: hasAssign, active: hasEstimate && !hasAssign, skip: false, duration: formatDuration(wo.estimate_approved_at || wo.submitted_at, wo.assigned_at), progress: totalJobs > 0 ? `${jobsAssigned}/${totalJobs} assigned` : null },
      { label: 'Parts', done: hasParts, active: hasEstimate && !hasParts, skip: noParts, duration: noParts ? null : formatDuration(wo.estimate_approved_at || wo.submitted_at, wo.parts_completed_at), progress: noParts ? null : `${partsReceived}/${activePartLines.length} received` },
      { label: 'Repair', done: hasRepair, active: hasAssign && hasParts && !hasRepair, skip: false, duration: formatDuration(wo.parts_completed_at || wo.assigned_at, wo.repair_completed_at), progress: totalJobs > 0 ? `${jobsComplete}/${totalJobs} complete` : null },
      { label: 'Invoice', done: hasInvoice, active: hasRepair && !hasInvoice, skip: false, duration: formatDuration(wo.repair_completed_at, wo.invoiced_at), progress: null },
    ]

    const totalDuration = formatDuration(wo.submitted_at, wo.invoiced_at)

    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 20px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0 }}>
          {steps.map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 58 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                  background: s.done ? GREEN : s.skip ? 'rgba(22,163,74,.1)' : s.active ? BLUE : '#E5E7EB',
                  color: s.done ? '#fff' : s.skip ? GREEN : s.active ? '#fff' : GRAY,
                }}>
                  {s.done ? '\u2713' : s.skip ? 'N/A' : i + 1}
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: s.done ? GREEN : s.active ? BLUE : GRAY, textTransform: 'uppercase', letterSpacing: '.03em', textAlign: 'center', lineHeight: 1.2 }}>{s.label}</span>
                {s.progress && !s.done && (
                  <span style={{ fontSize: 8, color: s.active ? BLUE : GRAY, textAlign: 'center' }}>{s.progress}</span>
                )}
                {s.duration && s.done && (
                  <span style={{ fontSize: 8, color: '#B0B0B0', textAlign: 'center' }}>{s.duration}</span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 20, height: 2, background: s.done ? GREEN : '#E5E7EB', margin: '13px 2px 0', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
        {totalDuration && (
          <div style={{ textAlign: 'center', fontSize: 10, color: '#B0B0B0', marginTop: 6 }}>
            Total: {totalDuration}
          </div>
        )}
      </div>
    )
  }

  // OLD stepper for legacy WOs (no submitted_at)
  const statusMap: Record<string, number> = {
    draft: 0, not_approved: 0, waiting_approval: 0,
    in_progress: 1, waiting_parts: 1,
    done: 2, good_to_go: 2, ready_final_inspection: 2, completed: 2, invoiced: 2, closed: 2,
  }
  const activeStep = statusMap[wo.status] ?? 0
  const oldSteps = [
    { label: 'Open', done: activeStep > 0 },
    { label: 'In Progress', done: activeStep > 1 },
    { label: 'Completed', done: activeStep > 2 },
  ]

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 20px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        {oldSteps.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                background: s.done ? GREEN : i === activeStep ? BLUE : '#E5E7EB',
                color: s.done || i === activeStep ? '#fff' : GRAY,
              }}>
                {s.done ? '\u2713' : i + 1}
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: s.done ? GREEN : i === activeStep ? BLUE : GRAY, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</span>
            </div>
            {i < oldSteps.length - 1 && (
              <div style={{ width: 40, height: 2, background: s.done ? GREEN : '#E5E7EB', margin: '0 4px', marginBottom: 16 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
