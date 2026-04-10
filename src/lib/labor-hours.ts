/**
 * TruckZen — Built-in Fallback Labor Hours
 * Primary source for v1. MOTOR / Mitchell 1 integration planned for later.
 *
 * Each entry: { fast, medium, long } in decimal hours.
 * Default applied = MEDIUM.
 * Service writer / supervisor can override after creation.
 * If no confident match, returns null — mechanic uses Request Hours flow.
 */

export interface LaborHoursEntry {
  fast: number
  medium: number
  long: number
}

// Keyword → labor hours. Checked in order — first match wins.
// More specific keywords MUST come before general ones.
const LABOR_HOURS_TABLE: [string[], LaborHoursEntry][] = [
  // PM / maintenance
  [['pm service', 'preventive maintenance', 'preventative maintenance'],
    { fast: 1.5, medium: 2.5, long: 4.0 }],
  [['oil change'],
    { fast: 0.5, medium: 1.0, long: 1.5 }],

  // Brakes
  [['brake adjustment', 'brake adjust'],
    { fast: 0.5, medium: 1.0, long: 1.5 }],
  [['brake repair', 'brake job', 'brake replace', 'brake pad', 'brake drum', 'brake shoe'],
    { fast: 1.5, medium: 3.0, long: 5.0 }],
  [['brake'],
    { fast: 1.0, medium: 2.0, long: 4.0 }],

  // Tires
  [['tire change', 'tire replacement', 'tire install', 'flat tire', 'blowout'],
    { fast: 0.5, medium: 1.0, long: 2.0 }],
  [['tire rotation', 'tire balance'],
    { fast: 0.5, medium: 0.75, long: 1.0 }],
  [['tire'],
    { fast: 0.5, medium: 1.0, long: 1.5 }],

  // Engine / drivetrain
  [['turbo', 'turbocharger'],
    { fast: 3.0, medium: 5.0, long: 8.0 }],
  [['clutch'],
    { fast: 4.0, medium: 6.0, long: 10.0 }],
  [['transmission'],
    { fast: 4.0, medium: 8.0, long: 12.0 }],
  [['water pump'],
    { fast: 2.0, medium: 3.5, long: 5.0 }],
  [['radiator'],
    { fast: 2.0, medium: 3.0, long: 5.0 }],
  [['alternator'],
    { fast: 1.0, medium: 2.0, long: 3.5 }],
  [['starter'],
    { fast: 1.0, medium: 2.0, long: 3.0 }],
  [['fuel filter', 'fuel pump', 'fuel injector', 'fuel system'],
    { fast: 1.0, medium: 2.0, long: 4.0 }],
  [['belt', 'serpentine'],
    { fast: 0.5, medium: 1.0, long: 2.0 }],

  // HVAC — use word-boundary-safe patterns to prevent "ac" matching inside "replace"
  [['ac repair', 'a/c repair', 'ac compressor', 'a/c compressor'],
    { fast: 2.0, medium: 4.0, long: 6.0 }],
  [['ac system', 'ac service', 'ac charge', 'ac leak', 'a/c system', 'a/c service', 'a/c charge', 'a/c leak', 'heater', 'hvac'],
    { fast: 1.0, medium: 2.0, long: 4.0 }],

  // Exhaust / emissions
  [['dpf', 'dpf clean', 'dpf regen', 'dpf replace'],
    { fast: 1.5, medium: 3.0, long: 5.0 }],
  [['egr'],
    { fast: 1.5, medium: 2.5, long: 4.0 }],
  [['exhaust'],
    { fast: 2.0, medium: 3.5, long: 6.0 }],

  // Electrical
  [['battery'],
    { fast: 0.25, medium: 0.5, long: 1.0 }],
  [['electrical', 'wiring', 'fuse', 'relay'],
    { fast: 0.5, medium: 1.5, long: 3.0 }],

  // Chassis / suspension
  [['king pin'],
    { fast: 2.0, medium: 3.5, long: 5.0 }],
  [['hub', 'wheel bearing', 'hub seal'],
    { fast: 1.5, medium: 2.5, long: 4.0 }],
  [['u joint', 'u-joint', 'driveshaft'],
    { fast: 1.0, medium: 2.0, long: 3.0 }],
  [['suspension', 'leaf spring', 'shock', 'air bag'],
    { fast: 1.0, medium: 2.0, long: 4.0 }],
  [['fifth wheel'],
    { fast: 0.5, medium: 1.0, long: 2.0 }],
  [['alignment'],
    { fast: 0.5, medium: 1.0, long: 1.5 }],

  // Body / glass
  [['windshield'],
    { fast: 1.0, medium: 2.0, long: 3.0 }],
  [['door', 'mirror', 'bumper'],
    { fast: 0.5, medium: 1.0, long: 2.0 }],
  [['headlight', 'taillight', 'light'],
    { fast: 0.25, medium: 0.5, long: 1.0 }],
  [['wiper'],
    { fast: 0.25, medium: 0.5, long: 0.75 }],

  // Diagnostic / inspection
  [['diagnostic', 'check engine', 'scan', 'troubleshoot'],
    { fast: 0.5, medium: 1.0, long: 2.0 }],
  [['inspection', 'dot inspection'],
    { fast: 0.5, medium: 1.0, long: 1.5 }],

  // Coolant
  [['coolant', 'overheat'],
    { fast: 0.5, medium: 1.0, long: 2.0 }],

  // Glad hand / air
  [['glad hand', 'glad-hand', 'gladhand', 'air leak'],
    { fast: 0.25, medium: 0.5, long: 1.0 }],

  // General cleaning (TZBridge7C)
  [['clean'],
    { fast: 0.5, medium: 1.0, long: 2.0 }],

  // Fridge install — approved mechanic expected time 0.5h (TZBridge7D)
  [['install fridge', 'add fridge'],
    { fast: 0.25, medium: 0.5, long: 1.0 }],

  // Compound labor phrases (TZBridge7C)
  [['tighten', 'secure'],
    { fast: 0.25, medium: 0.5, long: 1.0 }],
  [['drain and refill', 'refill'],
    { fast: 0.5, medium: 1.0, long: 2.0 }],
  [['differential'],
    { fast: 1.0, medium: 2.0, long: 3.5 }],
  [['fairing'],
    { fast: 0.25, medium: 0.5, long: 1.0 }],
]

export interface LaborHoursMatch {
  matched_key: string
  hours: LaborHoursEntry
}

/**
 * Look up fallback labor hours for a job description.
 * Returns the FIRST confident match, or null if no match.
 */
export function lookupLaborHours(jobDescription: string): LaborHoursMatch | null {
  if (!jobDescription || jobDescription.length < 2) return null
  const lower = jobDescription.toLowerCase()

  for (const [keywords, hours] of LABOR_HOURS_TABLE) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return { matched_key: kw, hours }
      }
    }
  }

  return null
}

/**
 * Get the default (MEDIUM) estimated hours for a job, or null if no match.
 */
export function getDefaultLaborHours(jobDescription: string): number | null {
  const match = lookupLaborHours(jobDescription)
  return match ? match.hours.medium : null
}
