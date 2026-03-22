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

export function getPartSuggestions(jobDescription: string, inventoryParts?: any[]): PartSuggestion[] {
  if (!jobDescription || jobDescription.length < 3) return []

  const lower = jobDescription.toLowerCase()
  const suggestions: PartSuggestion[] = []
  const seen = new Set<string>()

  // First: check inventory for matching parts
  if (inventoryParts) {
    for (const part of inventoryParts) {
      const desc = (part.description || '').toLowerCase()
      const pn = (part.part_number || '').toLowerCase()
      // Check if any word in the job description matches the part
      const words = lower.split(/\s+/).filter(w => w.length >= 3)
      const matches = words.some(w => desc.includes(w) || pn.includes(w))
      if (matches && !seen.has(desc)) {
        seen.add(desc)
        suggestions.push({
          description: part.description,
          source: 'inventory',
          on_hand: part.on_hand,
          part_number: part.part_number,
          id: part.id,
        })
      }
    }
  }

  // Second: check keyword map for common suggestions
  for (const [keyword, parts] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      for (const partName of parts) {
        const key = partName.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          suggestions.push({ description: partName, source: 'common' })
        }
      }
    }
  }

  return suggestions.slice(0, 12)
}
