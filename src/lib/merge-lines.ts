/**
 * TruckZen — Shared Job Line Merge Helper
 * Single source of truth for merging job lines on both review screen (draft)
 * and inside-WO screen (persisted). Service writer decides — no auto-merge.
 */

export interface DraftJobLine {
  description: string
  skills: string[]
  tirePositions: string[]
  isTire: boolean
  isDiagnostic: boolean
  roughParts: { rough_name: string; quantity: number; is_labor: boolean }[]
}

/**
 * Merge draft job lines into a single destination line.
 * Descriptions are combined with " + " separator.
 * Rough parts are preserved as separate itemized entries (never collapsed).
 * Skills are unioned. Tire positions are unioned.
 */
export function mergeDraftLines(
  destination: DraftJobLine,
  sources: DraftJobLine[]
): DraftJobLine {
  const allLines = [destination, ...sources]
  const descriptions = allLines.map(l => l.description.trim()).filter(Boolean)
  const mergedDescription = descriptions.join(' + ')

  // Union skills (deduplicated)
  const skillSet = new Set<string>()
  allLines.forEach(l => l.skills.forEach(s => skillSet.add(s)))

  // Union tire positions (deduplicated)
  const tireSet = new Set<string>()
  allLines.forEach(l => l.tirePositions.forEach(t => tireSet.add(t)))

  // Preserve all rough parts as separate itemized entries
  const mergedParts: DraftJobLine['roughParts'] = []
  allLines.forEach(l => l.roughParts.forEach(p => mergedParts.push({ ...p })))

  return {
    description: mergedDescription,
    skills: Array.from(skillSet),
    tirePositions: Array.from(tireSet),
    isTire: allLines.some(l => l.isTire),
    isDiagnostic: allLines.some(l => l.isDiagnostic),
    roughParts: mergedParts,
  }
}

/**
 * Merge persisted line descriptions deterministically.
 * Returns the combined description string.
 */
export function mergePersistedDescriptions(
  destinationDesc: string,
  sourceDescs: string[]
): string {
  const all = [destinationDesc, ...sourceDescs].map(d => d.trim()).filter(Boolean)
  return all.join(' + ')
}
