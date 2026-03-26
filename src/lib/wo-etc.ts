// ============================================================
// TRUCKZEN — ETC (Estimated Time of Completion) + Mechanic Suggestions
// Pure derivation — no DB calls, works on pre-fetched data
// ============================================================

export interface WOETC {
  estimated_labor_hours: number   // sum of estimated_hours across labor lines
  actual_labor_hours: number      // sum of clock time (duration_minutes) across time entries
  remaining_hours: number | null  // estimated - actual, or null if no estimate
  etc_label: string               // human-readable ETC
  confidence: 'high' | 'medium' | 'low' | 'none'
  parts_blocking: boolean         // true if any parts not received
  parts_blocking_count: number    // how many parts are not received
}

/**
 * Derive ETC for a work order.
 * Requires: wo.so_lines, wo.so_time_entries or timeEntries array
 */
export function deriveWOETC(wo: any, timeEntries?: any[]): WOETC {
  const soLines = wo.so_lines || []
  const laborLines = soLines.filter((l: any) => l.line_type === 'labor' || l.line_type === 'job')
  const partLines = soLines.filter((l: any) => l.line_type === 'part')

  // Estimated labor hours from line estimates
  const estimatedHours = laborLines.reduce((sum: number, l: any) => sum + (l.estimated_hours || 0), 0)

  // Actual hours from time entries (if available) or from so_lines.actual_hours
  const entries = timeEntries || wo.timeEntries || []
  let actualMinutes = 0
  if (entries.length > 0) {
    actualMinutes = entries
      .filter((e: any) => e.duration_minutes)
      .reduce((sum: number, e: any) => sum + (e.duration_minutes || 0), 0)
  } else {
    // Fallback: sum actual_hours from lines (may be stale/manual)
    actualMinutes = laborLines.reduce((sum: number, l: any) => sum + ((l.actual_hours || 0) * 60), 0)
  }
  const actualHours = Math.round(actualMinutes / 60 * 10) / 10

  // Parts blocking
  const unreceived = partLines.filter((l: any) =>
    l.parts_status && !['received', 'installed'].includes(l.parts_status) && !l.customer_provides_parts
  )

  // Remaining hours
  let remaining: number | null = null
  if (estimatedHours > 0) {
    remaining = Math.max(0, Math.round((estimatedHours - actualHours) * 10) / 10)
  }

  // Confidence
  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none'
  if (estimatedHours > 0 && laborLines.every((l: any) => l.estimated_hours > 0)) {
    confidence = 'high'
  } else if (estimatedHours > 0) {
    confidence = 'medium'
  } else if (laborLines.length > 0) {
    confidence = 'low'
  }

  // ETC label
  let etcLabel: string
  const allDone = laborLines.length > 0 && laborLines.every((l: any) => l.line_status === 'completed')
  if (allDone) {
    etcLabel = 'All jobs completed'
  } else if (remaining !== null && remaining > 0) {
    if (unreceived.length > 0) {
      etcLabel = `~${remaining}h remaining (${unreceived.length} part${unreceived.length > 1 ? 's' : ''} pending)`
    } else {
      etcLabel = `~${remaining}h remaining`
    }
  } else if (remaining === 0 && !allDone) {
    etcLabel = 'Over estimated time'
  } else if (unreceived.length > 0) {
    etcLabel = `Waiting on ${unreceived.length} part${unreceived.length > 1 ? 's' : ''}`
  } else if (laborLines.length === 0) {
    etcLabel = 'No job lines'
  } else {
    etcLabel = 'No time estimate available'
  }

  return {
    estimated_labor_hours: estimatedHours,
    actual_labor_hours: actualHours,
    remaining_hours: remaining,
    etc_label: etcLabel,
    confidence,
    parts_blocking: unreceived.length > 0,
    parts_blocking_count: unreceived.length,
  }
}

// ── Mechanic Suggestions ──

export interface MechanicSuggestion {
  user_id: string
  name: string
  team: string | null
  score: number
  reasons: string[]
  is_clocked_in: boolean
  active_jobs: number
}

/**
 * Score and rank mechanics for a job line.
 * Requires pre-fetched data arrays — no DB calls.
 *
 * @param requiredSkills - skills array from the so_line
 * @param mechanics - array of { id, full_name, team } from the users table
 * @param mechanicSkills - array from mechanic_skills table for this shop
 * @param clockedInIds - set of user_ids currently clocked in
 * @param jobCounts - map of user_id → number of active assigned jobs
 */
export function suggestMechanics(
  requiredSkills: string[],
  mechanics: any[],
  mechanicSkills: any[],
  clockedInIds: Set<string>,
  jobCounts: Record<string, number>,
): MechanicSuggestion[] {
  if (!mechanics || mechanics.length === 0) return []

  const requiredLower = (requiredSkills || []).map((s: string) => s.toLowerCase())

  return mechanics.map((mech: any) => {
    const reasons: string[] = []
    let score = 0

    // Skill match
    const mechSkills = mechanicSkills.filter((s: any) => s.user_id === mech.id)
    if (requiredLower.length > 0 && mechSkills.length > 0) {
      const matched = mechSkills.filter((s: any) =>
        requiredLower.some(req =>
          (s.skill_name || '').toLowerCase().includes(req) ||
          (s.skill_category || '').toLowerCase().includes(req)
        )
      )
      if (matched.length > 0) {
        score += 40
        reasons.push(`Skill match: ${matched.map((s: any) => s.skill_name).join(', ')}`)
        // Experience bonus
        const bestLevel = matched.reduce((best: number, s: any) => {
          const levels: Record<string, number> = { beginner: 5, intermediate: 10, experienced: 20, expert: 30 }
          return Math.max(best, levels[s.experience_level] || 0)
        }, 0)
        if (bestLevel > 0) score += bestLevel
        // Certified bonus
        if (matched.some((s: any) => s.certified)) {
          score += 10
          reasons.push('Certified')
        }
      }
    }

    // Availability
    const isIn = clockedInIds.has(mech.id)
    if (isIn) {
      score += 15
      reasons.push('Clocked in')
    } else {
      score -= 30
      reasons.push('Not clocked in')
    }

    // Workload
    const jobs = jobCounts[mech.id] || 0
    if (jobs === 0) {
      score += 10
      reasons.push('No active jobs')
    } else if (jobs <= 2) {
      score += 5
      reasons.push(`${jobs} active job${jobs > 1 ? 's' : ''}`)
    } else {
      score -= 10
      reasons.push(`${jobs} active jobs (heavy load)`)
    }

    return {
      user_id: mech.id,
      name: mech.full_name || 'Unknown',
      team: mech.team || null,
      score,
      reasons,
      is_clocked_in: isIn,
      active_jobs: jobs,
    }
  }).sort((a, b) => b.score - a.score)
}
