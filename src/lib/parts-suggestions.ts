/**
 * TruckZen — Original Design
 * Formula-based parts suggestion lookup — zero API cost
 */

const KEYWORD_MAP: Record<string, string[]> = {
  'oil change': ['Oil Filter', 'Engine Oil 15W-40', 'Drain Plug Gasket'],
  'oil': ['Oil Filter', 'Engine Oil 15W-40'],
  'brake': ['Brake Pads', 'Brake Rotor', 'Brake Caliper', 'Brake Fluid', 'Brake Drum'],
  'air filter': ['Air Filter', 'Air Filter Housing Gasket'],
  'coolant': ['Coolant', 'Thermostat', 'Radiator Hose', 'Water Pump'],
  'alternator': ['Alternator', 'Serpentine Belt', 'Alternator Bracket'],
  'starter': ['Starter Motor', 'Starter Solenoid'],
  'turbo': ['Turbocharger', 'Turbo Gasket Kit', 'Intercooler Hose'],
  'ac': ['AC Compressor', 'AC Condenser', 'Refrigerant R-134a', 'AC Dryer'],
  'a/c': ['AC Compressor', 'AC Condenser', 'Refrigerant R-134a', 'AC Dryer'],
  'transmission': ['Transmission Filter', 'Transmission Fluid', 'Shift Cable'],
  'fuel': ['Fuel Filter', 'Fuel Pump', 'Fuel Injector'],
  'exhaust': ['Exhaust Gasket', 'DPF Filter', 'EGR Valve', 'Exhaust Clamp'],
  'dpf': ['DPF Filter', 'DPF Gasket', 'DPF Sensor'],
  'egr': ['EGR Valve', 'EGR Cooler', 'EGR Gasket'],
  'tire': ['Tire', 'Valve Stem', 'Lug Nut'],
  'electrical': ['Fuse', 'Relay', 'Wiring Harness', 'Connector'],
  'suspension': ['Shock Absorber', 'Leaf Spring', 'U-Bolt', 'Bushing'],
  'clutch': ['Clutch Disc', 'Pressure Plate', 'Throw-Out Bearing', 'Clutch Fluid'],
  'battery': ['Battery', 'Battery Cable', 'Battery Terminal'],
  'belt': ['Serpentine Belt', 'Belt Tensioner'],
  'water pump': ['Water Pump', 'Water Pump Gasket', 'Coolant'],
  'radiator': ['Radiator', 'Radiator Hose', 'Radiator Cap', 'Coolant'],
  'headlight': ['Headlight Bulb', 'Headlight Assembly'],
  'wiper': ['Wiper Blade', 'Wiper Motor', 'Washer Fluid'],
  'mirror': ['Side Mirror', 'Mirror Glass', 'Mirror Bracket'],
  'door': ['Door Handle', 'Door Hinge', 'Door Seal'],
  'windshield': ['Windshield', 'Windshield Seal', 'Windshield Wiper'],
  'hub': ['Hub Seal', 'Hub Oil', 'Wheel Bearing'],
  'wheel bearing': ['Wheel Bearing', 'Bearing Seal', 'Hub Assembly'],
  'king pin': ['King Pin Kit', 'King Pin Bushing'],
  'fifth wheel': ['Fifth Wheel Grease', 'Fifth Wheel Lock'],
  'glad hand': ['Glad Hand', 'Glad Hand Seal'],
  'air bag': ['Air Bag (Suspension)', 'Air Bag Bracket'],
  'shock': ['Shock Absorber', 'Shock Mount', 'Shock Bushing'],
  'u joint': ['U-Joint', 'Driveshaft'],
  'pm': ['Oil Filter', 'Engine Oil 15W-40', 'Air Filter', 'Fuel Filter'],
  'preventive maintenance': ['Oil Filter', 'Engine Oil 15W-40', 'Air Filter', 'Fuel Filter', 'Coolant'],
}

export interface PartSuggestion {
  description: string
  source: 'inventory' | 'common'
  on_hand?: number
  part_number?: string
  id?: string
}

// Keywords that indicate NO parts needed (service/diagnostic jobs)
const NO_PARTS_KEYWORDS = ['alignment', 'going to left', 'going to right', 'pulling', 'check engine', 'diagnostic', 'inspection', 'scan', 'noise', 'vibration', 'test drive']

// Specific search terms to use for inventory lookup per concern keyword
const INVENTORY_SEARCH_TERMS: Record<string, string[]> = {
  'oil change': ['oil filter', 'oil', 'engine oil', 'drain plug'],
  'oil': ['oil filter', 'engine oil'],
  'pm': ['oil filter', 'engine oil', 'air filter', 'fuel filter', 'def'],
  'pm service': ['oil filter', 'engine oil', 'air filter', 'fuel filter', 'def', 'coolant'],
  'brake': ['brake pad', 'brake drum', 'brake shoe', 'brake rotor', 'brake fluid'],
  'tire': ['tire', 'valve stem', 'lug nut'],
  'bumper': ['bumper', 'bumper bracket', 'bumper bolt'],
  'alternator': ['alternator', 'belt', 'serpentine'],
  'starter': ['starter', 'starter motor', 'solenoid'],
  'battery': ['battery', 'battery cable', 'terminal'],
  'coolant': ['coolant', 'thermostat', 'radiator hose', 'water pump'],
  'turbo': ['turbocharger', 'turbo gasket', 'intercooler'],
  'ac': ['ac compressor', 'condenser', 'refrigerant', 'ac dryer'],
  'a/c': ['ac compressor', 'condenser', 'refrigerant'],
  'exhaust': ['exhaust gasket', 'dpf', 'egr', 'clamp'],
  'dpf': ['dpf filter', 'dpf gasket', 'dpf sensor'],
  'fuel': ['fuel filter', 'fuel pump', 'injector'],
  'clutch': ['clutch disc', 'pressure plate', 'throw-out bearing'],
  'windshield': ['windshield', 'windshield seal'],
  'door': ['door handle', 'door hinge', 'door seal'],
  'mirror': ['mirror', 'mirror glass', 'mirror bracket'],
  'hub': ['hub seal', 'hub oil', 'wheel bearing'],
  'suspension': ['shock', 'leaf spring', 'u-bolt', 'bushing'],
  'wiper': ['wiper blade', 'wiper motor'],
  'headlight': ['headlight bulb', 'headlight assembly'],
  'transmission': ['transmission filter', 'transmission fluid'],
}

export function getPartSuggestions(jobDescription: string, inventoryParts?: any[]): PartSuggestion[] {
  if (!jobDescription || jobDescription.length < 3) return []

  const lower = jobDescription.toLowerCase()

  // Check if this is a no-parts job (diagnostic, alignment, etc.)
  if (NO_PARTS_KEYWORDS.some(k => lower.includes(k))) return []

  const suggestions: PartSuggestion[] = []
  const seen = new Set<string>()

  // Find which concern keywords match
  const matchedSearchTerms: string[] = []
  for (const [keyword, terms] of Object.entries(INVENTORY_SEARCH_TERMS)) {
    if (lower.includes(keyword)) matchedSearchTerms.push(...terms)
  }

  // First: search inventory using ONLY relevant search terms (not every word)
  if (inventoryParts && matchedSearchTerms.length > 0) {
    const uniqueTerms = [...new Set(matchedSearchTerms)]
    for (const term of uniqueTerms) {
      for (const part of inventoryParts) {
        const desc = (part.description || '').toLowerCase()
        if (desc.includes(term) && !seen.has(desc)) {
          seen.add(desc)
          suggestions.push({ description: part.description, source: 'inventory', on_hand: part.on_hand, part_number: part.part_number, id: part.id })
          if (suggestions.filter(s => s.source === 'inventory').length >= 10) break
        }
      }
    }
  }

  // Second: keyword map for common suggestions NOT already in inventory results
  for (const [keyword, parts] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      for (const partName of parts) {
        const key = partName.toLowerCase()
        if (!seen.has(key)) { seen.add(key); suggestions.push({ description: partName, source: 'common' }) }
      }
    }
  }

  return suggestions.slice(0, 20)
}

// ── Auto rough parts generation ──

export interface RoughPart {
  rough_name: string
  quantity: number
  needs_clarification?: boolean
  is_labor: boolean
}

const DIAGNOSTIC_KEYWORDS = [
  'coolant leak', 'check engine', 'oil leak', 'noise', 'rattle', 'vibration',
  'overheating', 'won\'t start', 'wont start', 'no start', 'going to left',
  'going to right', 'pulling', 'electrical issue', 'air leak',
  'diagnostic', 'diagnostics', 'diagnosis',
  'inspect', 'inspection',
  'test drive', 'testing', 'scan',
  'checking', 'verify', 'verifying',
  'troubleshoot', 'troubleshooting',
  'hard to start',
]

const PM_PARTS: RoughPart[] = [
  { rough_name: 'Engine Oil (15W-40)', quantity: 10, is_labor: false },
  { rough_name: 'Oil Filter', quantity: 1, is_labor: false },
  { rough_name: 'Fuel Filter', quantity: 1, is_labor: false },
  { rough_name: 'Air Filter', quantity: 1, is_labor: false },
  { rough_name: 'DEF Fluid', quantity: 1, is_labor: false },
  { rough_name: 'Drain Plug Gasket', quantity: 1, is_labor: false },
  { rough_name: 'Coolant Check', quantity: 1, is_labor: true },
  { rough_name: 'Belt Inspection', quantity: 1, is_labor: true },
  { rough_name: 'Brake Inspection', quantity: 1, is_labor: true },
  { rough_name: 'Tire Inspection', quantity: 1, is_labor: true },
  { rough_name: 'Grease/Lubrication', quantity: 1, is_labor: true },
]

const OIL_CHANGE_PARTS: RoughPart[] = [
  { rough_name: 'Engine Oil (15W-40)', quantity: 10, is_labor: false },
  { rough_name: 'Oil Filter', quantity: 1, is_labor: false },
  { rough_name: 'Drain Plug Gasket', quantity: 1, is_labor: false },
]

const JOB_AUTO_PARTS: Record<string, RoughPart[]> = {
  // Phrase-priority entries (longer phrases must be listed so they match before shorter ones)
  'windshield wiper': [{ rough_name: 'Wiper Blade', quantity: 2, is_labor: false }],
  'wiper blade': [{ rough_name: 'Wiper Blade', quantity: 2, is_labor: false }],
  'hood mirror': [{ rough_name: 'Hood Mirror', quantity: 1, is_labor: false }],
  'door mirror': [{ rough_name: 'Door Mirror', quantity: 1, is_labor: false }],
  'door handle': [{ rough_name: 'Door Handle', quantity: 1, is_labor: false }],
  'cabin filter': [{ rough_name: 'Cabin Filter', quantity: 1, is_labor: false }],
  'air filter': [{ rough_name: 'Engine Air Filter', quantity: 1, is_labor: false }],
  'fuel filter': [{ rough_name: 'Fuel Filter', quantity: 1, is_labor: false }],
  'fuel pump': [{ rough_name: 'Fuel Pump', quantity: 1, is_labor: false }],
  'water pump': [{ rough_name: 'Water Pump', quantity: 1, is_labor: false }, { rough_name: 'Water Pump Gasket', quantity: 1, is_labor: false }],
  'hub seal': [{ rough_name: 'Hub Seal', quantity: 1, is_labor: false }, { rough_name: 'Hub Oil', quantity: 1, is_labor: false }],
  'wheel bearing': [{ rough_name: 'Wheel Bearing', quantity: 1, is_labor: false }],
  'king pin': [{ rough_name: 'King Pin Kit', quantity: 1, is_labor: false }],
  'u joint': [{ rough_name: 'U-Joint', quantity: 1, is_labor: false }],
  'slack adjuster': [{ rough_name: 'Slack Adjuster', quantity: 1, is_labor: false }],
  'air bag': [{ rough_name: 'Air Bag (Suspension)', quantity: 1, is_labor: false }],
  'glad hand': [{ rough_name: 'Glad Hand', quantity: 1, is_labor: false }, { rough_name: 'Glad Hand Seal', quantity: 1, is_labor: false }],
  'ac repair': [{ rough_name: 'AC Compressor', quantity: 1, is_labor: false }, { rough_name: 'Refrigerant', quantity: 1, is_labor: false }],
  'a/c': [{ rough_name: 'AC Compressor', quantity: 1, is_labor: false }, { rough_name: 'Refrigerant', quantity: 1, is_labor: false }],
  // Standard entries (shorter keywords — matched after longer phrases above)
  'alternator': [{ rough_name: 'Alternator', quantity: 1, is_labor: false }, { rough_name: 'Serpentine Belt', quantity: 1, is_labor: false }],
  'starter': [{ rough_name: 'Starter Motor', quantity: 1, is_labor: false }],
  'turbo': [{ rough_name: 'Turbocharger', quantity: 1, is_labor: false }, { rough_name: 'Turbo Gasket Kit', quantity: 1, is_labor: false }],
  'exhaust': [{ rough_name: 'Exhaust Gasket', quantity: 1, is_labor: false }, { rough_name: 'Exhaust Clamp', quantity: 1, is_labor: false }],
  'clutch': [{ rough_name: 'Clutch Disc', quantity: 1, is_labor: false }, { rough_name: 'Pressure Plate', quantity: 1, is_labor: false }, { rough_name: 'Throw-Out Bearing', quantity: 1, is_labor: false }],
  'battery': [{ rough_name: 'Battery', quantity: 1, is_labor: false }],
  'radiator': [{ rough_name: 'Radiator', quantity: 1, is_labor: false }],
  'windshield': [{ rough_name: 'Windshield', quantity: 1, is_labor: false }],
  'wiper': [{ rough_name: 'Wiper Blade', quantity: 2, is_labor: false }],
  'headlight': [{ rough_name: 'Headlight', quantity: 1, is_labor: false }],
  'belt': [{ rough_name: 'Serpentine Belt', quantity: 1, is_labor: false }],
  'thermostat': [{ rough_name: 'Thermostat', quantity: 1, is_labor: false }, { rough_name: 'Coolant', quantity: 1, is_labor: false }],
  'dpf': [{ rough_name: 'DPF Filter', quantity: 1, is_labor: false }],
  'egr': [{ rough_name: 'EGR Valve', quantity: 1, is_labor: false }],
  'bumper': [{ rough_name: 'Bumper', quantity: 1, is_labor: false }],
  'fender': [{ rough_name: 'Fender', quantity: 1, is_labor: false }],
  'hood': [{ rough_name: 'Hood', quantity: 1, is_labor: false }],
  'mirror': [{ rough_name: 'Mirror', quantity: 1, is_labor: false }],
  'door': [{ rough_name: 'Door', quantity: 1, is_labor: false }],
}

/** Check if a job line's rough parts indicate noun-only ambiguity needing clarification */
export function needsClarification(roughParts: RoughPart[]): boolean {
  return roughParts.some(p => p.needs_clarification === true)
}

/** Clarification options for noun-only input (legacy default) */
export const CLARIFICATION_OPTIONS = ['Replace', 'Install', 'Repair', 'Inspect'] as const

// ══ INTENT-AWARE CLARIFICATION (TZBridge4) ══

export type ClarificationCategory = 'generic_installable' | 'repair_or_replace' | 'existing_default'

const INSTALLABLE_NOUNS = ['fridge', 'refrigerator', 'microwave', 'inverter', 'tv', 'television', 'cb radio', 'radio', 'gps', 'dashcam', 'dash cam', 'coffee maker']
const REPAIR_OR_REPLACE_NOUNS = ['windshield', 'hood', 'bumper', 'fender', 'mirror', 'door', 'grille', 'visor', 'panel']

/** Determine clarification category for a noun-only input */
export function getClarificationCategory(rawInput: string): ClarificationCategory {
  const lower = rawInput.toLowerCase().trim()
  if (INSTALLABLE_NOUNS.some(n => lower.includes(n))) return 'generic_installable'
  if (REPAIR_OR_REPLACE_NOUNS.some(n => lower.includes(n))) return 'repair_or_replace'
  return 'existing_default'
}

/** Get intent-aware clarification options for the given input */
export function getClarificationOptionsForInput(rawInput: string): string[] {
  const category = getClarificationCategory(rawInput)
  switch (category) {
    case 'generic_installable': return ['Install', 'Add']
    case 'repair_or_replace': return ['Replace', 'Repair']
    case 'existing_default': return [...CLARIFICATION_OPTIONS]
  }
}

export function isDiagnosticJob(desc: string): boolean {
  const lower = desc.toLowerCase()
  return DIAGNOSTIC_KEYWORDS.some(k => lower.includes(k))
}

/** Check if a job description should be allowed to create a fallback rough part (TZBridgeFixAB2).
 *  Returns true ONLY for safe explicit part-candidate lines (replace/install/add verb).
 *  PM/Oil, material_expected (drain-and-refill), and all labor intents are excluded.
 *  Better no fallback part than a fake fallback part. */
export function shouldCreateFallbackPart(jobDescription: string): boolean {
  if (!jobDescription || isDiagnosticJob(jobDescription)) return false
  const { intent } = detectVerbIntent(jobDescription)
  if (intent === 'part_candidate') return true
  if (intent === 'labor_unless_replacement' && hasExplicitReplacement(jobDescription)) return true
  return false
}

/** Resolve a clarification choice into a clean description (TZBridge7B).
 *  Strips existing action verbs from the base phrase before prepending the chosen action. */
export function resolveClarification(chosenAction: string, rawDescription: string): string {
  const lower = rawDescription.toLowerCase().trim()
  // Strip leading compound verb phrases
  const stripped = lower
    .replace(/^(remove\s+and\s+replace|drain\s+and\s+refill|check\s+and\s+tighten|check\s+and\s+adjust)\s+/i, '')
    .replace(/^(replace|install|add|repair|fix|adjust|tighten|align|check|clean|wash|grease|inspect|diagnose|test|remove|perform|do|change)\s+/i, '')
    .trim()
  const base = stripped || rawDescription.trim()
  // Capitalize first letter of base
  const cleanBase = base.charAt(0).toUpperCase() + base.slice(1)
  return `${chosenAction} ${cleanBase}`
}

// ══ POST-DETERMINISTIC BRAIN ADAPTER SEAM (TZBridge6) ══
// This adapter runs ONLY at the review step, AFTER deterministic parsing and clarification.
// It must NEVER override deterministic truth. It must NEVER run before clarification resolves.
// Currently a no-op — later patches will inject safe-family historical suggestions here.

export interface BrainAssistRequest {
  job_description: string
  deterministic_rough_parts: string[]
  is_diagnostic: boolean
  is_tire: boolean
  asset_make?: string | null
  asset_model?: string | null
  asset_year?: number | null
}

export interface BrainAssistSuggestion {
  description: string
  part_number?: string
  suggested_quantity: number
  confidence: 'high' | 'medium' | 'low'
  source: 'historical_brain'
  historical_wo_count: number
}

export interface BrainAssistResponse {
  suggestions: BrainAssistSuggestion[]
}

// ══ PM / OIL CHANGE ASSIST SEED (TZBridge7) ══
// Smallest curated suggestion data for PM Service and Oil Change only.
// Derived from Brain1-4 historical evidence (33,250 WOs). Not a full catalog.

const PM_OIL_ASSIST_SEED: Record<string, BrainAssistSuggestion[]> = {
  volvo: [
    { description: 'Engine Oil 15W-40', part_number: 'MOBIL DELVAC', suggested_quantity: 44, confidence: 'high', source: 'historical_brain', historical_wo_count: 1634 },
    { description: 'Oil Filter', part_number: 'LF667', suggested_quantity: 2, confidence: 'high', source: 'historical_brain', historical_wo_count: 774 },
    { description: 'Fuel Filter', part_number: 'FF5507', suggested_quantity: 1, confidence: 'high', source: 'historical_brain', historical_wo_count: 891 },
  ],
  freightliner: [
    { description: 'Engine Oil 10W-30', part_number: 'MOBIL DELVAC', suggested_quantity: 44, confidence: 'high', source: 'historical_brain', historical_wo_count: 914 },
    { description: 'Oil Filter', part_number: 'A4711800209', suggested_quantity: 1, confidence: 'high', source: 'historical_brain', historical_wo_count: 664 },
    { description: 'Fuel Filter', part_number: 'FK48002', suggested_quantity: 1, confidence: 'high', source: 'historical_brain', historical_wo_count: 500 },
  ],
  _default: [
    { description: 'Engine Oil', suggested_quantity: 44, confidence: 'medium', source: 'historical_brain', historical_wo_count: 3877 },
    { description: 'Oil Filter', suggested_quantity: 1, confidence: 'medium', source: 'historical_brain', historical_wo_count: 3758 },
    { description: 'Fuel Filter', suggested_quantity: 1, confidence: 'medium', source: 'historical_brain', historical_wo_count: 1914 },
  ],
}

const PM_OIL_PATTERNS = [/\bpm\b/i, /\bpreventive\s*maint/i, /\bpreventative\s*maint/i, /\bpm\s*service/i, /\boil\s*change/i, /\bengine\s*oil\s*change/i]

function isPmOrOilChangeJob(description: string): boolean {
  const lower = description.toLowerCase()
  return PM_OIL_PATTERNS.some(p => p.test(lower))
}

/** Post-deterministic brain adapter — returns PM/Oil Change assist for approved families.
 *  All other families return empty. Deterministic truth is never overridden. */
export function getBrainAssist(lines: BrainAssistRequest[]): BrainAssistResponse[] {
  return lines.map(line => {
    // Bypass: diagnostic, tire, or not PM/Oil Change family
    if (line.is_diagnostic || line.is_tire || !isPmOrOilChangeJob(line.job_description)) {
      return { suggestions: [] }
    }

    // Pick make-conditioned seed
    const make = (line.asset_make || '').toLowerCase()
    const seed = make.includes('volvo') ? PM_OIL_ASSIST_SEED.volvo
      : make.includes('freightliner') ? PM_OIL_ASSIST_SEED.freightliner
      : PM_OIL_ASSIST_SEED._default

    // Filter out suggestions already covered by deterministic rough parts
    const existingLower = new Set(line.deterministic_rough_parts.map(p => p.toLowerCase()))
    const filtered = seed.filter(s => !existingLower.has(s.description.toLowerCase()))

    return { suggestions: filtered }
  })
}

export function getAutoRoughParts(jobDescription: string, tirePositions?: string[]): RoughPart[] {
  if (!jobDescription) return []
  const lower = jobDescription.toLowerCase()

  // Diagnostic jobs — no auto parts
  if (isDiagnosticJob(lower)) return []

  // ══ STEP 1: Multi-part splitting FIRST ══
  // Split on +, and, &, commas — preserve verb per segment
  const segments = jobDescription.trim().split(/\s*(?:\+|,|\band\b|&)\s*/i).map(s => s.trim()).filter(s => s.length > 2)
  if (segments.length >= 2) {
    const allParts: RoughPart[] = []
    for (const seg of segments) {
      const segParts = parseSingleSegment(seg, tirePositions)
      allParts.push(...segParts)
    }
    return allParts.length > 0 ? allParts : segments.map(seg => ({ rough_name: seg, quantity: 1, is_labor: false }))
  }

  // ══ STEP 2: Single segment parsing ══
  return parseSingleSegment(jobDescription, tirePositions)
}

// ══ PRE-AI DETERMINISTIC GATE (TZBridge2) ══

export type PreAiDecision = 'deterministic_simple' | 'ambiguous_noun_only' | 'send_to_ai'

/**
 * Classify raw complaint text BEFORE sending to AI.
 * Returns whether the complaint can be handled deterministically or needs AI splitting.
 */
// Known PM/Oil Change family phrases that are deterministic even without a leading verb (TZBridge7A)
const PM_OIL_FAMILY_PHRASES = [/^pm$/i, /^pm\s+service/i, /^preventive\s+maint/i, /^preventative\s+maint/i, /^oil\s+change/i, /^engine\s+oil\s+change/i, /^perform\s+pm/i, /^do\s+pm/i, /^perform\s+preventive/i, /^perform\s+preventative/i, /^do\s+oil\s+change/i, /^perform\s+oil\s+change/i]

function isPmOilFamilyPhrase(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return PM_OIL_FAMILY_PHRASES.some(p => p.test(lower))
}

export function preClassifyComplaint(rawComplaint: string): PreAiDecision {
  const trimmed = rawComplaint.trim()
  if (!trimmed) return 'send_to_ai'

  // Multi-segment complaints need AI for proper splitting
  const segments = trimmed.split(/\s*(?:\+|,|\band\b|&)\s*/i).map(s => s.trim()).filter(s => s.length > 2)
  if (segments.length >= 2) return 'send_to_ai'

  // Long or multi-sentence complaints need AI
  if (trimmed.split(/\s+/).length > 12) return 'send_to_ai'
  if (/[.;]/.test(trimmed) && trimmed.split(/[.;]/).filter(s => s.trim().length > 3).length >= 2) return 'send_to_ai'

  // Approved PM/Oil family phrases — deterministic even without a leading verb (TZBridge7A)
  if (isPmOilFamilyPhrase(trimmed)) return 'deterministic_simple'

  // Single segment — check verb intent
  const { intent } = detectVerbIntent(trimmed)

  // Clear verb found — deterministic can handle it
  if (intent === 'part_candidate' || intent === 'no_auto_parts' || intent === 'labor_only' ||
      intent === 'labor_unless_replacement' || intent === 'material_expected') {
    return 'deterministic_simple'
  }

  // No verb — noun-only ambiguous
  if (intent === 'ambiguous') {
    return 'ambiguous_noun_only'
  }

  return 'send_to_ai'
}

// ══ VERB CONSTANTS (hoisted for use by splitter and parser) ══

const PART_CANDIDATE_VERBS = ['replace', 'install', 'add']
const NO_AUTO_PARTS_VERBS = ['clean', 'wash', 'grease', 'inspect', 'diagnose', 'diagnostic', 'test']
const LABOR_ONLY_VERBS = ['fix', 'adjust', 'tighten', 'align', 'check']
const MATERIAL_VERBS = ['change']

// ══ PRE-AI MIXED-LINE SPLITTING (TZBridge3) ══

export type PreRouteDecision = 'deterministic_single' | 'deterministic_multi' | 'ambiguous_noun_only' | 'send_to_ai'

export interface PreRouteResult {
  decision: PreRouteDecision
  segments: string[]
}

/** Check if a segment is complete enough to stand alone (not just a bare verb) */
function isCompleteSegment(seg: string): boolean {
  const words = seg.trim().split(/\s+/).filter(w => w.length > 0)
  // A standalone segment needs at least a verb + object (2+ meaningful words)
  return words.length >= 2
}

/** Check if a segment starts with a recognizable action verb */
function startsWithActionVerb(seg: string): boolean {
  const first = seg.trim().split(/\s+/)[0]?.toLowerCase()
  if (!first) return false
  const allVerbs = [...PART_CANDIDATE_VERBS, ...NO_AUTO_PARTS_VERBS, ...LABOR_ONLY_VERBS, 'repair', 'change']
  return allVerbs.includes(first)
}

/** Split raw complaint into candidate segments using safe boundary rules.
 *  Strong delimiters (+, ;, newline) always split.
 *  Soft delimiters (, and, &) only split when both sides are independently actionable. */
export function splitComplaintIntoDeterministicSegments(rawComplaint: string): string[] {
  const trimmed = rawComplaint.trim()

  // Phase 1: Split on strong delimiters (always safe)
  const strongParts = trimmed.split(/\s*[+;\n]\s*/).map(s => s.trim()).filter(s => s.length > 2)

  // Phase 2: For each strong part, try soft splitting on "and" / "&" / ","
  const result: string[] = []
  for (const part of strongParts) {
    // Try splitting on ", " or " and " or " & "
    const softCandidates = part.split(/\s*(?:,\s+|\band\b|&)\s*/i).map(s => s.trim()).filter(s => s.length > 2)

    if (softCandidates.length >= 2) {
      // Split when every candidate is a complete segment (≥2 words). This still
      // blocks bare-verb splits like "check and tighten fairings" ("check" is
      // 1 word → fails isCompleteSegment) but allows noun-led concerns like
      // "tire replacement" to stay separate — they render as distinct draft
      // lines and the existing per-line clarification UI resolves them.
      const allComplete = softCandidates.every(seg => isCompleteSegment(seg))
      if (allComplete) {
        result.push(...softCandidates)
      } else {
        result.push(part)
      }
    } else {
      result.push(part)
    }
  }

  return result
}

/** Classify full complaint for pre-AI routing with multi-segment support */
export function preRouteComplaintBeforeAi(rawComplaint: string): PreRouteResult {
  const trimmed = rawComplaint.trim()
  if (!trimmed) return { decision: 'send_to_ai', segments: [trimmed] }

  // Strong-delimiter split runs first: the user explicitly separated concerns
  // with newline/+/; — those boundaries MUST be preserved as separate draft
  // lines, even if an individual segment classifies as ambiguous. Otherwise
  // a single ambiguous segment collapses all concerns back into one line.
  const strongSegments = trimmed.split(/\s*[+;\n]\s*/).map(s => s.trim()).filter(s => s.length > 2)
  if (strongSegments.length >= 2) {
    return { decision: 'deterministic_multi', segments: strongSegments }
  }

  // Long or multi-sentence without strong delimiters → AI
  if (trimmed.split(/\s+/).length > 12) return { decision: 'send_to_ai', segments: [trimmed] }
  if (/[.;]/.test(trimmed) && trimmed.split(/[.;]/).filter(s => s.trim().length > 3).length >= 2) {
    return { decision: 'send_to_ai', segments: [trimmed] }
  }

  const segments = splitComplaintIntoDeterministicSegments(trimmed)

  // Single segment — delegate to existing single-segment classifier
  if (segments.length <= 1) {
    const single = preClassifyComplaint(trimmed)
    if (single === 'deterministic_simple') return { decision: 'deterministic_single', segments: [trimmed] }
    if (single === 'ambiguous_noun_only') return { decision: 'ambiguous_noun_only', segments: [trimmed] }
    return { decision: 'send_to_ai', segments: [trimmed] }
  }

  // Multi-segment via soft delimiters ("and", "&", ","): require every segment
  // to classify deterministic_simple OR ambiguous_noun_only — both render as
  // distinct draft lines; ambiguous segments surface per-line clarification.
  // Only bail to AI if a segment is fully unclassifiable.
  const classifications = segments.map(seg => preClassifyComplaint(seg))
  if (classifications.every(c => c === 'deterministic_simple' || c === 'ambiguous_noun_only')) {
    return { decision: 'deterministic_multi', segments }
  }

  return { decision: 'send_to_ai', segments: [trimmed] }
}

// ══ DETERMINISTIC VERB-INTENT PARSING (Patch 109) ══

// Abbreviation normalization
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bDS\b/gi, 'driver side'],
  [/\bPS\b/gi, 'passenger side'],
  [/\bLH\b/gi, 'left'],
  [/\bRH\b/gi, 'right'],
  [/\bFRHT\b/gi, 'freightliner'],
]

function normalizeText(text: string): string {
  let result = text
  for (const [pattern, replacement] of ABBREVIATIONS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// Verb → intent mapping
type VerbIntent = 'part_candidate' | 'no_auto_parts' | 'labor_only' | 'labor_unless_replacement' | 'material_expected' | 'ambiguous'

// Compound verb phrases that resolve to a single intent (TZBridge7B)
const COMPOUND_VERB_PHRASES: [RegExp, VerbIntent][] = [
  [/^remove\s+and\s+replace\b/i, 'part_candidate'],
  [/^drain\s+and\s+refill\b/i, 'material_expected'],
  [/^check\s+and\s+(tighten|adjust|secure)\b/i, 'labor_only'],
  [/^perform\s+(pm|preventive|preventative|oil change)/i, 'material_expected'],
  [/^do\s+(pm|preventive|preventative|oil change)/i, 'material_expected'],
]

function detectVerbIntent(text: string): { intent: VerbIntent; verb: string | null } {
  const lower = text.toLowerCase().trim()
  const firstWord = lower.split(/\s+/)[0]

  // Compound verb phrases first (TZBridge7B)
  for (const [pattern, intent] of COMPOUND_VERB_PHRASES) {
    if (pattern.test(lower)) return { intent, verb: lower.match(pattern)?.[0] || firstWord }
  }

  // Check first word against verb categories
  if (PART_CANDIDATE_VERBS.includes(firstWord)) return { intent: 'part_candidate', verb: firstWord }
  if (NO_AUTO_PARTS_VERBS.includes(firstWord)) return { intent: 'no_auto_parts', verb: firstWord }
  if (LABOR_ONLY_VERBS.includes(firstWord)) return { intent: 'labor_only', verb: firstWord }
  if (firstWord === 'repair') return { intent: 'labor_unless_replacement', verb: 'repair' }
  if (MATERIAL_VERBS.includes(firstWord)) return { intent: 'material_expected', verb: firstWord }

  // Check if ANY verb appears in the text (not just first word)
  for (const v of PART_CANDIDATE_VERBS) { if (lower.includes(v)) return { intent: 'part_candidate', verb: v } }
  for (const v of MATERIAL_VERBS) { if (lower.includes(v)) return { intent: 'material_expected', verb: v } }
  for (const v of NO_AUTO_PARTS_VERBS) { if (lower.includes(v)) return { intent: 'no_auto_parts', verb: v } }
  for (const v of LABOR_ONLY_VERBS) { if (lower.includes(v)) return { intent: 'labor_only', verb: v } }

  // No verb found — noun-only input
  return { intent: 'ambiguous', verb: null }
}

/** Check if repair text also has explicit replacement language */
function hasExplicitReplacement(text: string): boolean {
  const lower = text.toLowerCase()
  return ['replace', 'install', 'new ', 'swap', 'put in', 'with new'].some(w => lower.includes(w))
}

/** Extract explicit quantity from text like "all 3 cabin filters", "2x wipers", "replace 4 tires" */
function extractQuantity(text: string): { quantity: number; cleaned: string } {
  // "all N items" / "N items" / "Nx items"
  const numMatch = text.match(/\b(?:all\s+)?(\d+)\s*x?\s+/i)
  if (numMatch) {
    const qty = parseInt(numMatch[1])
    if (qty > 0 && qty <= 100) {
      return { quantity: qty, cleaned: text.replace(numMatch[0], '').trim() }
    }
  }
  return { quantity: 1, cleaned: text }
}

/** Parse a single job segment into rough parts */
function parseSingleSegment(text: string, tirePositions?: string[]): RoughPart[] {
  if (!text) return []
  // Step 0: normalize abbreviations
  const normalized = normalizeText(text)
  const lower = normalized.toLowerCase().trim()
  // Extract explicit quantity early
  const { quantity: explicitQty, cleaned: cleanedText } = extractQuantity(normalized)

  // ══ STEP 1: Deterministic verb-intent detection ══
  const { intent, verb } = detectVerbIntent(lower)

  // No auto parts for clean/wash/grease/inspect/diagnose/test — return empty (labor-only, no rough parts)
  if (intent === 'no_auto_parts') return []

  // Labor only for fix/adjust/tighten/align/check — return empty (labor-only, no rough parts)
  if (intent === 'labor_only') return []

  // Repair = labor only UNLESS explicit replacement language present
  if (intent === 'labor_unless_replacement' && !hasExplicitReplacement(lower)) return []

  // ══ Continue with part-candidate / material / ambiguous intents ══

  // Noun-only / ambiguous: block keyword guessing, require clarification
  if (intent === 'ambiguous') {
    const component = normalized.trim()
    return [{ rough_name: component, quantity: explicitQty, is_labor: false, needs_clarification: true }]
  }

  // Spare tire — distinct from axle tires, no position semantics
  if (lower.includes('spare') && (lower.includes('tire') || lower.includes('tyre'))) {
    const spareQty = explicitQty > 1 ? explicitQty : 1
    return [{ rough_name: 'Spare Tire', quantity: spareQty, is_labor: false }]
  }

  // Tire jobs
  if (['tire', 'tyre', 'flat', 'blowout'].some(k => lower.includes(k))) {
    if (tirePositions && tirePositions.length > 0) {
      const steerCount = tirePositions.filter(p => p.includes('Steer')).length
      const driveCount = tirePositions.filter(p => p.includes('2nd')).length
      const rearCount = tirePositions.filter(p => p.includes('3rd')).length
      const parts: RoughPart[] = []
      if (steerCount > 0) parts.push({ rough_name: `${steerCount}x Steer Tire${steerCount > 1 ? 's' : ''}`, quantity: steerCount, is_labor: false })
      if (driveCount > 0) parts.push({ rough_name: `${driveCount}x Drive Axle Tire${driveCount > 1 ? 's' : ''}`, quantity: driveCount, is_labor: false })
      if (rearCount > 0) parts.push({ rough_name: `${rearCount}x Rear Axle Tire${rearCount > 1 ? 's' : ''}`, quantity: rearCount, is_labor: false })
      if (parts.length === 0) parts.push({ rough_name: `${tirePositions.length}x Tire${tirePositions.length > 1 ? 's' : ''}`, quantity: tirePositions.length, is_labor: false })
      return parts
    }
    // No positions selected — use explicit quantity if stated (e.g. "replace 4 tires"), otherwise 1
    const tireQty = explicitQty > 1 ? explicitQty : 1
    return [{ rough_name: 'Tire', quantity: tireQty, is_labor: false }, { rough_name: 'Valve Stem', quantity: tireQty, is_labor: false }]
  }

  // PM Service
  if (['pm service', 'pm ', 'preventive maintenance', 'preventative maintenance'].some(k => lower.includes(k))) return PM_PARTS

  // Brake adjustment — labor only
  if (lower.includes('brake adjustment') || lower.includes('brake adjust')) return []

  // Brake repair — preserve exact components
  if (lower.includes('brake') && (lower.includes('repair') || lower.includes('job') || lower.includes('replace'))) {
    const parts: RoughPart[] = []
    const brakeQty = explicitQty > 1 ? explicitQty : 1
    if (lower.includes('drum')) parts.push({ rough_name: 'Brake Drum', quantity: brakeQty, is_labor: false })
    if (lower.includes('shoe')) parts.push({ rough_name: 'Brake Shoes', quantity: brakeQty, is_labor: false })
    if (lower.includes('pad')) parts.push({ rough_name: 'Brake Pads', quantity: brakeQty, is_labor: false })
    if (lower.includes('rotor')) parts.push({ rough_name: 'Brake Rotor', quantity: brakeQty, is_labor: false })
    if (lower.includes('caliper')) parts.push({ rough_name: 'Brake Caliper', quantity: brakeQty, is_labor: false })
    if (parts.length > 0) return parts
    return [{ rough_name: 'Brake Parts', quantity: brakeQty, is_labor: false }]
  }

  // Oil change — preserve viscosity and quantity. Rough name uses plain
  // "Engine Oil <viscosity>" (no parens) so server-side component-word match
  // against shop inventory descriptions (e.g. "Rotella T4 15W-40 Engine Oil")
  // can still find real shop oil before falling back to generic.
  if ((lower.includes('oil change') || lower.includes('oil filter') || lower.includes('engine oil')) && !lower.includes('pm')) {
    const viscosityMatch = text.match(/\b(\d+[Ww]-?\d+)\b/)
    const oilName = viscosityMatch ? `Engine Oil ${viscosityMatch[1].toUpperCase()}` : 'Engine Oil 15W-40'
    return [
      { rough_name: 'Oil Filter', quantity: 1, is_labor: false },
      { rough_name: oilName, quantity: 10, is_labor: false },
      { rough_name: 'Drain Plug Gasket', quantity: 1, is_labor: false },
    ]
  }

  // Greasing — labor service, no physical parts
  if (lower.includes('greas') || lower.includes('lubrication')) {
    return [{ rough_name: 'Grease/Lubrication', quantity: 1, is_labor: true }]
  }

  // ══ Phrase-priority keyword lookup ══
  // Sort keywords longest-first so "windshield wiper" beats "windshield",
  // "hood mirror" beats "hood", "door handle" beats "door"
  const sortedKeywords = Object.keys(JOB_AUTO_PARTS).sort((a, b) => b.length - a.length)

  for (const keyword of sortedKeywords) {
    if (lower.includes(keyword)) {
      const parts = JOB_AUTO_PARTS[keyword]
      // Domain guard: preserve the exact requested component instead of narrowing
      const requestedComponent = cleanedText.trim().replace(/^(replace|install|swap|new|repair|fix|change)\s+/i, '').trim()
      if (requestedComponent.length > 0 && parts.length === 1) {
        const suggestedLower = parts[0].rough_name.toLowerCase()
        const requestedLower = requestedComponent.toLowerCase()
        if (suggestedLower !== requestedLower && requestedLower.includes(keyword)) {
          return [{ rough_name: requestedComponent, quantity: Math.max(explicitQty, parts[0].quantity), is_labor: false }]
        }
      }
      // Apply explicit quantity if provided
      if (explicitQty > 1) return parts.map(p => ({ ...p, quantity: p.is_labor ? p.quantity : explicitQty }))
      return parts
    }
  }

  // Fallback: return the stripped component name as a single rough part
  const component = cleanedText.trim().replace(/^(replace|install|swap|new|repair|fix|change)\s+/i, '').trim()
  if (component.length > 2) {
    return [{ rough_name: component, quantity: explicitQty, is_labor: false }]
  }

  return []
}
