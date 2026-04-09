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
  is_labor: boolean
}

const DIAGNOSTIC_KEYWORDS = [
  'coolant leak', 'check engine', 'oil leak', 'noise', 'rattle', 'vibration',
  'overheating', 'won\'t start', 'wont start', 'no start', 'going to left',
  'going to right', 'pulling', 'electrical issue', 'air leak',
  'diagnostic', 'diagnostics', 'diagnosis',
  'inspect', 'inspection',
  'test drive', 'testing', 'scan',
  'check ', 'checking', 'verify', 'verifying',
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
  'alternator': [{ rough_name: 'Alternator', quantity: 1, is_labor: false }, { rough_name: 'Serpentine Belt', quantity: 1, is_labor: false }],
  'starter': [{ rough_name: 'Starter Motor', quantity: 1, is_labor: false }],
  'ac repair': [{ rough_name: 'AC Compressor', quantity: 1, is_labor: false }, { rough_name: 'Refrigerant', quantity: 1, is_labor: false }],
  'a/c': [{ rough_name: 'AC Compressor', quantity: 1, is_labor: false }, { rough_name: 'Refrigerant', quantity: 1, is_labor: false }],
  'turbo': [{ rough_name: 'Turbocharger', quantity: 1, is_labor: false }, { rough_name: 'Turbo Gasket Kit', quantity: 1, is_labor: false }],
  'exhaust': [{ rough_name: 'Exhaust Gasket', quantity: 1, is_labor: false }, { rough_name: 'Exhaust Clamp', quantity: 1, is_labor: false }],
  'clutch': [{ rough_name: 'Clutch Disc', quantity: 1, is_labor: false }, { rough_name: 'Pressure Plate', quantity: 1, is_labor: false }, { rough_name: 'Throw-Out Bearing', quantity: 1, is_labor: false }],
  'battery': [{ rough_name: 'Battery', quantity: 1, is_labor: false }],
  'water pump': [{ rough_name: 'Water Pump', quantity: 1, is_labor: false }, { rough_name: 'Water Pump Gasket', quantity: 1, is_labor: false }],
  'radiator': [{ rough_name: 'Radiator', quantity: 1, is_labor: false }],
  'windshield': [{ rough_name: 'Windshield', quantity: 1, is_labor: false }, { rough_name: 'Windshield Seal', quantity: 1, is_labor: false }],
  'air filter': [{ rough_name: 'Air Filter', quantity: 1, is_labor: false }],
  'fuel filter': [{ rough_name: 'Fuel Filter', quantity: 1, is_labor: false }],
  'fuel pump': [{ rough_name: 'Fuel Pump', quantity: 1, is_labor: false }],
  'wiper': [{ rough_name: 'Wiper Blade', quantity: 2, is_labor: false }],
  'headlight': [{ rough_name: 'Headlight Bulb', quantity: 1, is_labor: false }],
  'hub seal': [{ rough_name: 'Hub Seal', quantity: 1, is_labor: false }, { rough_name: 'Hub Oil', quantity: 1, is_labor: false }],
  'wheel bearing': [{ rough_name: 'Wheel Bearing', quantity: 1, is_labor: false }],
  'king pin': [{ rough_name: 'King Pin Kit', quantity: 1, is_labor: false }],
  'belt': [{ rough_name: 'Serpentine Belt', quantity: 1, is_labor: false }],
  'thermostat': [{ rough_name: 'Thermostat', quantity: 1, is_labor: false }, { rough_name: 'Coolant', quantity: 1, is_labor: false }],
  'dpf': [{ rough_name: 'DPF Filter', quantity: 1, is_labor: false }],
  'egr': [{ rough_name: 'EGR Valve', quantity: 1, is_labor: false }],
  'bumper': [{ rough_name: 'Bumper', quantity: 1, is_labor: false }, { rough_name: 'Bumper Bracket', quantity: 1, is_labor: false }],
  'fender': [{ rough_name: 'Fender', quantity: 1, is_labor: false }],
  'hood': [{ rough_name: 'Hood', quantity: 1, is_labor: false }],
  'mirror': [{ rough_name: 'Side Mirror', quantity: 1, is_labor: false }],
  'door': [{ rough_name: 'Door Handle', quantity: 1, is_labor: false }],
  'glad hand': [{ rough_name: 'Glad Hand', quantity: 1, is_labor: false }, { rough_name: 'Glad Hand Seal', quantity: 1, is_labor: false }],
  'air bag': [{ rough_name: 'Air Bag (Suspension)', quantity: 1, is_labor: false }],
  'u joint': [{ rough_name: 'U-Joint', quantity: 1, is_labor: false }],
  'slack adjuster': [{ rough_name: 'Slack Adjuster', quantity: 1, is_labor: false }],
}

export function isDiagnosticJob(desc: string): boolean {
  const lower = desc.toLowerCase()
  return DIAGNOSTIC_KEYWORDS.some(k => lower.includes(k))
}

export function getAutoRoughParts(jobDescription: string, tirePositions?: string[]): RoughPart[] {
  if (!jobDescription) return []
  const lower = jobDescription.toLowerCase()

  // Diagnostic jobs — no auto parts
  if (isDiagnosticJob(lower)) return []

  // Tire jobs — generate from positions if available, otherwise generic fallback
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
    // No positions selected — still needs a tire as rough part
    return [{ rough_name: 'Tire', quantity: 1, is_labor: false }, { rough_name: 'Valve Stem', quantity: 1, is_labor: false }]
  }

  // PM Service
  if (['pm service', 'pm ', 'preventive maintenance', 'preventative maintenance'].some(k => lower.includes(k))) return PM_PARTS

  // Brake adjustment — labor only, no parts
  if (lower.includes('brake adjustment') || lower.includes('brake adjust')) return []

  // Brake repair/job — preserve exact requested brake components
  if (lower.includes('brake') && (lower.includes('repair') || lower.includes('job') || lower.includes('replace'))) {
    const parts: RoughPart[] = []
    if (lower.includes('drum')) parts.push({ rough_name: 'Brake Drum', quantity: 1, is_labor: false })
    if (lower.includes('shoe')) parts.push({ rough_name: 'Brake Shoes', quantity: 1, is_labor: false })
    if (lower.includes('pad')) parts.push({ rough_name: 'Brake Pads', quantity: 1, is_labor: false })
    if (lower.includes('rotor')) parts.push({ rough_name: 'Brake Rotor', quantity: 1, is_labor: false })
    if (lower.includes('caliper')) parts.push({ rough_name: 'Brake Caliper', quantity: 1, is_labor: false })
    if (parts.length > 0) return parts
    // Generic brake job with no specific component
    return [{ rough_name: 'Brake Parts', quantity: 1, is_labor: false }]
  }

  // Oil change — preserve explicit viscosity and quantity from canonical template
  if ((lower.includes('oil change') || lower.includes('oil filter')) && !lower.includes('pm')) {
    const viscosityMatch = jobDescription.match(/\b(\d+[Ww]-?\d+)\b/)
    const oilName = viscosityMatch ? `Engine Oil (${viscosityMatch[1].toUpperCase()})` : 'Engine Oil (15W-40)'
    return [
      { rough_name: 'Oil Filter', quantity: 1, is_labor: false },
      { rough_name: oilName, quantity: 10, is_labor: false },
      { rough_name: 'Drain Plug Gasket', quantity: 1, is_labor: false },
    ]
  }

  // Other common jobs — use keyword lookup but with domain-preservation guard:
  // If the job description explicitly names a broader assembly, do not narrow to a subcomponent
  for (const [keyword, parts] of Object.entries(JOB_AUTO_PARTS)) {
    if (lower.includes(keyword)) {
      // Domain guard: strip common action verbs to extract the actual requested component
      const requestedComponent = jobDescription.trim().replace(/^(replace|install|swap|new|repair|fix|change)\s+/i, '').trim()
      // If the requested component is broader than the suggested part, preserve the request
      if (requestedComponent.length > 0 && parts.length === 1) {
        const suggestedLower = parts[0].rough_name.toLowerCase()
        const requestedLower = requestedComponent.toLowerCase()
        // Don't narrow "headlight" → "Headlight Bulb" unless "bulb" is in the request
        if (requestedLower.includes(keyword) && !requestedLower.includes(suggestedLower.replace(keyword, '').trim()) && suggestedLower !== requestedLower) {
          return [{ rough_name: requestedComponent, quantity: parts[0].quantity, is_labor: false }]
        }
      }
      return parts
    }
  }

  // Multi-part text splitting: if description contains multiple distinct parts
  // joined by separators (+, and, &, commas), split into separate itemized rough parts
  const stripped = jobDescription.trim().replace(/^(replace|install|swap|new|repair|fix|change)\s+/i, '').trim()
  const segments = stripped.split(/\s*(?:\+|,|\band\b|&)\s*/i).map(s => s.trim()).filter(s => s.length > 2)
  if (segments.length >= 2) {
    return segments.map(seg => ({ rough_name: seg, quantity: 1, is_labor: false }))
  }

  return []
}
