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
