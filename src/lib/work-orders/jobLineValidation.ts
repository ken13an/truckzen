// Deterministic job-line validation. Used by the WO detail page to render
// per-line warnings and by /api/estimates/[id]/send to block estimate send
// when an unresolved generic-tire line remains. Pure function — no DB calls,
// no AI, no schema assumptions beyond fields already present on so_lines.

export type JobLineWarningCode = 'GENERIC_TIRE_POSITION_REQUIRED'

export interface JobLineValidationOk {
  valid: true
}

export interface JobLineValidationIssue {
  valid: false
  severity: 'blocking'
  code: JobLineWarningCode
  message: string
  requiredFields: string[]
}

export type JobLineValidationResult = JobLineValidationOk | JobLineValidationIssue

export interface JobLineValidationInput {
  id?: string | null
  description?: string | null
  line_type?: string | null
  line_status?: string | null
  status?: string | null
  parts_status?: string | null
  is_canceled?: boolean | null
  tire_position?: string | null
}

export interface JobLineValidationFailure {
  line_id: string | null
  description: string
  code: JobLineWarningCode
  message: string
  requiredFields: string[]
}

// Whole-word match against tire-related vocabulary. Excludes plain "wheel"
// since alignment/wheel-bearing jobs aren't tire-position-required.
const GENERIC_TIRE_RE = /\b(tire|tyre|tires|tyres|flat|blowout)\b/i

// Position keywords that, when present in description, count as
// position-qualified even if tire_position column is empty (covers free-form
// notes like "DS steer tire replacement"). Whole-word, case-insensitive.
const POSITION_RE = /\b(steer|drive|trailer|axle|axles|inside|outside|inner|outer|ds|ps|driver\s+side|passenger\s+side|front|rear)\b/i

const CANCELED_LINE_STATUSES = new Set(['canceled', 'cancelled', 'void', 'deleted'])
const CANCELED_PARTS_STATUSES = new Set(['canceled', 'cancelled'])

export function isLineCanceled(line: JobLineValidationInput): boolean {
  if (line.is_canceled === true) return true
  const ls = (line.line_status || '').toLowerCase()
  if (CANCELED_LINE_STATUSES.has(ls)) return true
  const st = (line.status || '').toLowerCase()
  if (CANCELED_LINE_STATUSES.has(st)) return true
  const ps = (line.parts_status || '').toLowerCase()
  if (CANCELED_PARTS_STATUSES.has(ps)) return true
  return false
}

function isLaborLine(line: JobLineValidationInput): boolean {
  // Default to labor when line_type missing — matches WO detail page filter
  // (`l.line_type !== 'part'`).
  return (line.line_type || 'labor') !== 'part'
}

// Live-edit helper: lets the WO detail editor decide whether to surface
// tire-position UI based on the description being typed, using the same
// vocabulary as the deterministic validator above.
export function isTireRelatedDescription(description: string | null | undefined): boolean {
  return GENERIC_TIRE_RE.test((description || '').trim())
}

export function validateJobLine(line: JobLineValidationInput): JobLineValidationResult {
  if (!isLaborLine(line)) return { valid: true }
  if (isLineCanceled(line)) return { valid: true }

  const description = (line.description || '').trim()
  if (!description) return { valid: true }

  const isTireRelated = GENERIC_TIRE_RE.test(description)
  if (!isTireRelated) return { valid: true }

  const tirePos = (line.tire_position || '').trim()
  const hasPositionMetadata = tirePos.length > 0 || POSITION_RE.test(description)
  if (hasPositionMetadata) return { valid: true }

  return {
    valid: false,
    severity: 'blocking',
    code: 'GENERIC_TIRE_POSITION_REQUIRED',
    message: 'Specify tire position before sending estimate.',
    requiredFields: ['tire_position'],
  }
}

export function validateJobLines(lines: JobLineValidationInput[]): JobLineValidationFailure[] {
  const failures: JobLineValidationFailure[] = []
  for (const line of lines || []) {
    const result = validateJobLine(line)
    if (!result.valid) {
      failures.push({
        line_id: line.id ?? null,
        description: (line.description || '').trim(),
        code: result.code,
        message: result.message,
        requiredFields: result.requiredFields,
      })
    }
  }
  return failures
}
