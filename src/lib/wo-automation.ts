// ============================================================
// TRUCKZEN — Work Order Automation Visibility
// Pure derivation: owner / next_action / blocked_by
// No side effects, no DB calls — works on any WO object
// ============================================================

export interface WOAutomation {
  owner: string          // who is responsible right now
  next_action: string    // what needs to happen next
  blocked_by: string | null  // what is preventing progress, or null
  stage: string          // canonical stage name for grouping
  // SLA / Aging
  stage_entered_at: string | null  // ISO timestamp when current stage started
  stage_age_hours: number | null   // hours in current stage
  total_age_hours: number | null   // hours since WO submitted
  is_overdue: boolean              // true if exceeds SLA for current stage
  exception: string | null         // exception queue category, or null if healthy
}

// SLA thresholds in hours per stage (configurable later)
const SLA_HOURS: Record<string, number> = {
  draft: 24,
  estimate_needed: 4,
  estimate_pending: 48,
  estimate_declined: 24,
  waiting_approval: 24,
  parts_sourcing: 8,
  parts_waiting: 72,
  ready_for_assignment: 4,
  in_repair: 48,
  repair_complete: 4,
  ready_for_invoice: 8,
  invoice_review: 24,
  invoiced: 168, // 7 days
  paid: 24,
}

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return ms > 0 ? Math.round(ms / 3600000 * 10) / 10 : 0
}

function stageEnteredAt(wo: any, stage: string): string | null {
  // Best-effort: pick the timestamp that marks entry into this stage
  switch (stage) {
    case 'draft': return wo.created_at || null
    case 'estimate_needed':
    case 'estimate_pending':
    case 'estimate_declined':
    case 'waiting_approval':
      return wo.submitted_at || wo.created_at || null
    case 'parts_sourcing':
    case 'parts_waiting':
    case 'ready_for_assignment':
      return wo.estimate_approved_at || wo.submitted_at || wo.created_at || null
    case 'in_repair':
      return wo.assigned_at || wo.parts_completed_at || wo.updated_at || null
    case 'repair_complete':
      return wo.repair_completed_at || wo.updated_at || null
    case 'ready_for_invoice':
      return wo.repair_completed_at || wo.updated_at || null
    case 'invoice_review':
      return wo.updated_at || null
    case 'invoiced':
      return wo.invoiced_at || wo.updated_at || null
    case 'paid':
      return wo.updated_at || null
    case 'closed':
    case 'void':
      return wo.closed_at || wo.updated_at || null
    default:
      return wo.updated_at || wo.created_at || null
  }
}

function deriveException(stage: string, isOverdue: boolean, wo: any): string | null {
  if (stage === 'closed' || stage === 'void') return null
  if (stage === 'estimate_pending' && isOverdue) return 'waiting_estimate'
  if (stage === 'estimate_needed') return 'waiting_estimate'
  if (stage === 'estimate_declined') return 'waiting_estimate'
  if (stage === 'waiting_approval') return 'waiting_warranty'
  if (stage === 'parts_sourcing' || stage === 'parts_waiting') return 'waiting_parts'
  if (stage === 'ready_for_assignment') return 'waiting_assignment'
  if (stage === 'in_repair' && isOverdue) return 'overdue_in_repair'
  if (stage === 'repair_complete' || stage === 'ready_for_invoice') return 'ready_for_invoice'
  if (stage === 'invoiced' && isOverdue) return 'waiting_payment'
  if (isOverdue) return 'blocked_other'
  return null
}

type BaseAutomation = { owner: string; next_action: string; blocked_by: string | null; stage: string }

function deriveBase(wo: any): BaseAutomation {
  const status = wo.status || 'draft'
  const invoiceStatus = wo.invoice_status || ''
  const estimateRequired = wo.estimate_required === true
  const estimateApproved = wo.estimate_approved === true
  const estimateStatus = wo.estimate_status || ''

  const soLines = wo.so_lines || []
  const laborLines = soLines.filter((l: any) => l.line_type === 'labor' || l.line_type === 'job')
  const partLines = soLines.filter((l: any) => l.line_type === 'part')

  const hasAssignedTech = !!wo.assigned_tech || laborLines.some((l: any) => l.assigned_to)
  const allJobsCompleted = laborLines.length > 0 && laborLines.every((l: any) => l.line_status === 'completed')
  const roughPartsRemaining = partLines.filter((l: any) => l.rough_name && !l.real_name && !l.customer_provides_parts).length
  const partsNotReceived = partLines.filter((l: any) => l.parts_status && !['received', 'installed'].includes(l.parts_status) && !l.customer_provides_parts).length

  // ── DRAFT ──
  if (status === 'draft') {
    return {
      owner: 'service_writer',
      next_action: 'Complete and submit work order',
      blocked_by: null,
      stage: 'draft',
    }
  }

  // ── WAITING APPROVAL (estimate flow) ──
  if (status === 'waiting_approval') {
    if (estimateRequired && !estimateApproved) {
      if (estimateStatus === 'sent') {
        return {
          owner: 'customer',
          next_action: 'Approve or decline estimate',
          blocked_by: 'Waiting on customer estimate approval',
          stage: 'estimate_pending',
        }
      }
      if (estimateStatus === 'declined') {
        return {
          owner: 'service_writer',
          next_action: 'Revise estimate or contact customer',
          blocked_by: 'Estimate declined by customer',
          stage: 'estimate_declined',
        }
      }
      // Estimate not yet sent
      return {
        owner: 'service_writer',
        next_action: 'Build and send estimate to customer',
        blocked_by: 'Estimate required but not sent',
        stage: 'estimate_needed',
      }
    }
    // Waiting approval for other reasons (warranty, etc.)
    return {
      owner: 'service_writer',
      next_action: 'Review and approve work order',
      blocked_by: 'Awaiting approval',
      stage: 'waiting_approval',
    }
  }

  // ── IN PROGRESS ──
  if (status === 'in_progress' || status === 'waiting_parts') {
    // Parts dept needs to source rough parts
    if (roughPartsRemaining > 0) {
      return {
        owner: 'parts_dept',
        next_action: `Source ${roughPartsRemaining} rough part${roughPartsRemaining > 1 ? 's' : ''}`,
        blocked_by: status === 'waiting_parts' ? 'Waiting on parts' : null,
        stage: 'parts_sourcing',
      }
    }

    // Parts ordered/not yet received
    if (partsNotReceived > 0 && status === 'waiting_parts') {
      return {
        owner: 'parts_dept',
        next_action: `Receive ${partsNotReceived} part${partsNotReceived > 1 ? 's' : ''}`,
        blocked_by: 'Waiting on parts delivery',
        stage: 'parts_waiting',
      }
    }

    // No mechanic assigned yet
    if (!hasAssignedTech) {
      return {
        owner: 'floor_manager',
        next_action: 'Assign mechanic to job lines',
        blocked_by: null,
        stage: 'ready_for_assignment',
      }
    }

    // Mechanic assigned, work in progress
    if (!allJobsCompleted) {
      return {
        owner: 'mechanic',
        next_action: 'Complete assigned job lines',
        blocked_by: partsNotReceived > 0 ? `${partsNotReceived} part(s) not yet received` : null,
        stage: 'in_repair',
      }
    }

    // All jobs done but status hasn't advanced
    return {
      owner: 'service_writer',
      next_action: 'Review completed work and advance to invoicing',
      blocked_by: null,
      stage: 'repair_complete',
    }
  }

  // ── DONE / COMPLETED ──
  if (status === 'done' || status === 'completed') {
    if (!invoiceStatus || invoiceStatus === 'draft' || invoiceStatus === 'quality_check_failed') {
      return {
        owner: 'service_writer',
        next_action: 'Submit to accounting for invoice review',
        blocked_by: invoiceStatus === 'quality_check_failed' ? 'Quality check failed — fix issues' : null,
        stage: 'ready_for_invoice',
      }
    }
    if (invoiceStatus === 'pending_accounting' || invoiceStatus === 'accounting_review') {
      return {
        owner: 'accounting',
        next_action: 'Review and approve invoice',
        blocked_by: null,
        stage: 'invoice_review',
      }
    }
    if (invoiceStatus === 'accounting_approved' || invoiceStatus === 'sent_to_customer' || invoiceStatus === 'sent') {
      return {
        owner: 'customer',
        next_action: 'Pay invoice',
        blocked_by: 'Waiting on customer payment',
        stage: 'invoiced',
      }
    }
    if (invoiceStatus === 'paid') {
      return {
        owner: 'accounting',
        next_action: 'Close work order',
        blocked_by: null,
        stage: 'paid',
      }
    }
    if (invoiceStatus === 'closed') {
      return {
        owner: 'none',
        next_action: 'Complete',
        blocked_by: null,
        stage: 'closed',
      }
    }
  }

  // ── GOOD TO GO (terminal) ──
  if (status === 'good_to_go') {
    return {
      owner: 'none',
      next_action: 'Complete — truck ready for pickup',
      blocked_by: null,
      stage: 'closed',
    }
  }

  // ── VOID ──
  if (status === 'void') {
    return {
      owner: 'none',
      next_action: 'Voided',
      blocked_by: null,
      stage: 'void',
    }
  }

  // ── FALLBACK ──
  return {
    owner: 'unknown',
    next_action: `Status: ${status}`,
    blocked_by: null,
    stage: status,
  }
}

export function deriveWOAutomation(wo: any): WOAutomation {
  const base = deriveBase(wo)
  const entered = stageEnteredAt(wo, base.stage)
  const stageAge = hoursSince(entered)
  const totalAge = hoursSince(wo.submitted_at || wo.created_at)
  const slaLimit = SLA_HOURS[base.stage]
  const isOverdue = slaLimit != null && stageAge != null && stageAge > slaLimit
  const exception = deriveException(base.stage, isOverdue, wo)

  return {
    ...base,
    stage_entered_at: entered,
    stage_age_hours: stageAge,
    total_age_hours: totalAge,
    is_overdue: isOverdue,
    exception,
  }
}

/**
 * Derive automation for a single job line (so_line).
 */
export function deriveLineAutomation(line: any): { owner: string; next_action: string; blocked_by: string | null } {
  const lineStatus = line.line_status || 'unassigned'
  const partsStatus = line.parts_status

  if (line.line_type === 'part') {
    if (!partsStatus || partsStatus === 'rough') {
      return { owner: 'parts_dept', next_action: 'Source this part', blocked_by: null }
    }
    if (partsStatus === 'sourced') {
      return { owner: 'parts_dept', next_action: 'Order part', blocked_by: null }
    }
    if (partsStatus === 'ordered') {
      return { owner: 'parts_dept', next_action: 'Receive part', blocked_by: 'Waiting on delivery' }
    }
    if (partsStatus === 'received') {
      return { owner: 'mechanic', next_action: 'Install part', blocked_by: null }
    }
    if (partsStatus === 'installed') {
      return { owner: 'none', next_action: 'Complete', blocked_by: null }
    }
  }

  // Labor/job lines
  if (lineStatus === 'unassigned') {
    return { owner: 'floor_manager', next_action: 'Assign mechanic', blocked_by: null }
  }
  if (lineStatus === 'pending_review') {
    return { owner: 'service_writer', next_action: 'Review and approve', blocked_by: null }
  }
  if (lineStatus === 'approved') {
    return { owner: 'floor_manager', next_action: 'Assign mechanic', blocked_by: null }
  }
  if (lineStatus === 'in_progress') {
    return { owner: 'mechanic', next_action: 'Complete work', blocked_by: null }
  }
  if (lineStatus === 'completed') {
    return { owner: 'none', next_action: 'Complete', blocked_by: null }
  }

  return { owner: 'unknown', next_action: lineStatus, blocked_by: null }
}
