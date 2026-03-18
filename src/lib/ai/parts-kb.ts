// lib/ai/parts-kb.ts
// Knowledge base for the AI Service Writer and Parts Suggestion engine
// 50+ service types with expected parts, labor hours, and common causes

export interface ServiceKBEntry {
  service_type:    string
  keywords:        string[]
  typical_parts:   { description: string; part_category: string; required: boolean }[]
  labor_hours_min: number
  labor_hours_max: number
  common_causes:   string[]
  applies_to:      string[]  // engine types or makes
}

export const PARTS_KB: ServiceKBEntry[] = [
  {
    service_type:    'Oil Change — 15W-40',
    keywords:        ['oil change','pm service','oil service','oil filter','15w40','15w-40','lube service'],
    typical_parts: [
      { description:'Engine Oil 15W-40 — 5 Gallon', part_category:'Filters & Fluids', required:true },
      { description:'Primary Oil Filter',           part_category:'Filters & Fluids', required:true },
      { description:'Secondary Oil Filter',         part_category:'Filters & Fluids', required:false },
      { description:'Drain Plug Gasket',            part_category:'Engine',           required:false },
    ],
    labor_hours_min: 0.5,
    labor_hours_max: 1.5,
    common_causes:   ['Scheduled PM interval reached','Oil degradation','Contamination'],
    applies_to:      ['all'],
  },
  {
    service_type:    'DPF Cleaning',
    keywords:        ['dpf','diesel particulate','regen','regeneration','dpf cleaning','dpf filter','back pressure'],
    typical_parts: [
      { description:'DPF Filter (if beyond cleaning)',   part_category:'Engine', required:false },
      { description:'DPF Gasket Kit',                   part_category:'Engine', required:false },
      { description:'EGR Valve Cleaner',                part_category:'Filters & Fluids', required:false },
    ],
    labor_hours_min: 2.0,
    labor_hours_max: 6.0,
    common_causes:   ['Extended idle time','Short trips without highway regen','Failed active regen','Faulty NOx sensor'],
    applies_to:      ['PACCAR MX-13','Detroit DD15','Cummins ISX15','Volvo D13'],
  },
  {
    service_type:    'Brake Job — Full Set',
    keywords:        ['brakes','brake pads','brake shoes','braking','brake fade','pulling','ABS','brake chamber'],
    typical_parts: [
      { description:'Brake Pad Set — Front',            part_category:'Brakes', required:true },
      { description:'Brake Pad Set — Rear Drive Axle',  part_category:'Brakes', required:true },
      { description:'Brake Rotors — Front (if scored)',  part_category:'Brakes', required:false },
      { description:'Brake Chambers (if leaking)',       part_category:'Brakes', required:false },
      { description:'Slack Adjusters',                   part_category:'Brakes', required:false },
      { description:'S-Cam Bushings',                    part_category:'Brakes', required:false },
    ],
    labor_hours_min: 3.0,
    labor_hours_max: 7.0,
    common_causes:   ['Lining worn to limit','Brake fade under load','Air leak in chamber','Out-of-adjustment slack'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Rear Main Seal',
    keywords:        ['rear main seal','rear main','oil leak rear','crankshaft seal rear','rear crank seal','flywheel housing leak'],
    typical_parts: [
      { description:'Rear Main Crankshaft Seal Kit',    part_category:'Engine', required:true },
      { description:'Flywheel Housing Gasket',           part_category:'Engine', required:true },
      { description:'Engine Oil 15W-40 — 5 Gallon',    part_category:'Filters & Fluids', required:true },
      { description:'Primary Oil Filter',               part_category:'Filters & Fluids', required:true },
    ],
    labor_hours_min: 8.0,
    labor_hours_max: 14.0,
    common_causes:   ['Seal lip hardened from age/heat','Crankshaft wear','Excessive crankcase pressure from bad EGR','Seal installed dry'],
    applies_to:      ['PACCAR MX-13','Detroit DD15','Cummins ISX15'],
  },
  {
    service_type:    'Front Crankshaft Seal',
    keywords:        ['front main seal','front crank seal','front crankshaft','damper seal','vibration damper leak'],
    typical_parts: [
      { description:'Front Crankshaft Seal',            part_category:'Engine', required:true },
      { description:'Vibration Damper (inspect)',       part_category:'Engine', required:false },
      { description:'Engine Oil 15W-40 — 5 Gallon',   part_category:'Filters & Fluids', required:true },
    ],
    labor_hours_min: 3.0,
    labor_hours_max: 6.0,
    common_causes:   ['Seal aged and hardened','Damper wobble causing lip wear','Incorrect installation'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Turbocharger Replacement',
    keywords:        ['turbo','turbocharger','boost','no boost','black smoke','blow-by','turbo whine','turbo noise','shaft play'],
    typical_parts: [
      { description:'Turbocharger Assembly — OEM',      part_category:'Engine', required:true },
      { description:'Turbo Oil Feed Line',              part_category:'Engine', required:true },
      { description:'Turbo Oil Return Line',            part_category:'Engine', required:true },
      { description:'Turbo Mount Gasket Set',           part_category:'Engine', required:true },
      { description:'Engine Oil 15W-40 — 5 Gallon',   part_category:'Filters & Fluids', required:true },
      { description:'Primary Oil Filter',              part_category:'Filters & Fluids', required:true },
    ],
    labor_hours_min: 5.0,
    labor_hours_max: 9.0,
    common_causes:   ['Oil starvation from clogged feed line','Foreign object ingestion','Extended oil change intervals','Heat damage from coolant loss'],
    applies_to:      ['PACCAR MX-13','Detroit DD15','Cummins ISX15','Volvo D13'],
  },
  {
    service_type:    'EGR Valve Service',
    keywords:        ['egr','exhaust gas recirculation','egr valve','egr cooler','egr stuck','idle rough','fault code','soot buildup'],
    typical_parts: [
      { description:'EGR Valve — OEM',                  part_category:'Engine', required:true },
      { description:'EGR Cooler (if cracked)',          part_category:'Engine', required:false },
      { description:'EGR Gasket Kit',                   part_category:'Engine', required:true },
      { description:'EGR Valve Cleaner Spray',          part_category:'Filters & Fluids', required:false },
    ],
    labor_hours_min: 3.0,
    labor_hours_max: 7.0,
    common_causes:   ['Carbon buildup on valve seat','Failed actuator motor','Cracked EGR cooler tubes','Extended idle operation'],
    applies_to:      ['PACCAR MX-13','Detroit DD15','Cummins ISX15'],
  },
  {
    service_type:    'Cooling System — Thermostat',
    keywords:        ['thermostat','overheating','hot','temperature','coolant temp','running hot','cooling system'],
    typical_parts: [
      { description:'Thermostat Kit — OEM',             part_category:'Engine', required:true },
      { description:'Thermostat Housing Gasket',        part_category:'Engine', required:true },
      { description:'Extended Life Coolant — 1 Gallon', part_category:'Filters & Fluids', required:false },
    ],
    labor_hours_min: 1.0,
    labor_hours_max: 2.5,
    common_causes:   ['Thermostat stuck closed','Thermostat stuck open (no heat)','Failed wax element from age'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Coolant Flush',
    keywords:        ['coolant flush','antifreeze','coolant change','freeze protection','coolant maintenance'],
    typical_parts: [
      { description:'Extended Life Coolant — 5 Gallon', part_category:'Filters & Fluids', required:true },
      { description:'Cooling System Flush Chemical',    part_category:'Filters & Fluids', required:false },
      { description:'Coolant Filter',                   part_category:'Filters & Fluids', required:false },
      { description:'Radiator Cap',                     part_category:'Engine', required:false },
    ],
    labor_hours_min: 1.5,
    labor_hours_max: 2.5,
    common_causes:   ['Scheduled maintenance','Coolant degradation','Contamination from blown head gasket'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Water Pump Replacement',
    keywords:        ['water pump','coolant leak front','weep hole','pump bearing','coolant pump'],
    typical_parts: [
      { description:'Water Pump Assembly — OEM',        part_category:'Engine', required:true },
      { description:'Water Pump Gasket/Seal Kit',       part_category:'Engine', required:true },
      { description:'Drive Belt (replace if applicable)',part_category:'Engine', required:false },
      { description:'Extended Life Coolant — 5 Gallon', part_category:'Filters & Fluids', required:true },
    ],
    labor_hours_min: 2.5,
    labor_hours_max: 5.0,
    common_causes:   ['Bearing failure from age','Seal failure — coolant from weep hole','Impeller erosion from old coolant'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Air Dryer Service',
    keywords:        ['air dryer','air dryer cartridge','purging','air leak','compressor','air system','air dryer purge'],
    typical_parts: [
      { description:'Air Dryer Cartridge/Desiccant',    part_category:'Brakes', required:true },
      { description:'Air Dryer Purge Valve',            part_category:'Brakes', required:false },
      { description:'Air Dryer Safety Valve',           part_category:'Brakes', required:false },
    ],
    labor_hours_min: 0.5,
    labor_hours_max: 1.5,
    common_causes:   ['Desiccant saturated from extended interval','Oil carry-over from compressor','Frozen in winter'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Transmission Service',
    keywords:        ['transmission','trans fluid','gear oil','shifting hard','slipping','transmission service','allison','eaton'],
    typical_parts: [
      { description:'Transmission Fluid — OEM Spec',    part_category:'Filters & Fluids', required:true },
      { description:'Transmission Filter Kit',          part_category:'Filters & Fluids', required:true },
      { description:'Transmission Pan Gasket',          part_category:'Transmission', required:true },
    ],
    labor_hours_min: 1.5,
    labor_hours_max: 3.0,
    common_causes:   ['Fluid degradation from heat cycles','Extended service interval','Contamination from internal leak'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Differential Service',
    keywords:        ['differential','diff','rear end','axle oil','diff service','gear oil','pinion seal','diff leak'],
    typical_parts: [
      { description:'Differential Gear Oil — 75W-90',  part_category:'Filters & Fluids', required:true },
      { description:'Differential Cover Gasket',       part_category:'Drivetrain', required:true },
      { description:'Pinion Seal (if leaking)',        part_category:'Drivetrain', required:false },
    ],
    labor_hours_min: 1.0,
    labor_hours_max: 2.0,
    common_causes:   ['Scheduled interval','Gear oil breakdown','Overheating from overloading'],
    applies_to:      ['all'],
  },
  {
    service_type:    'DOT Annual Inspection',
    keywords:        ['dot inspection','annual inspection','dot annual','federal inspection','safety inspection','ifta inspection'],
    typical_parts: [
      { description:'Brake Lining (if worn)',           part_category:'Brakes',  required:false },
      { description:'Marker Lights (as needed)',        part_category:'Lights',  required:false },
      { description:'Reflective Tape',                  part_category:'Body',    required:false },
      { description:'Fire Extinguisher (if expired)',   part_category:'Safety',  required:false },
    ],
    labor_hours_min: 1.5,
    labor_hours_max: 2.5,
    common_causes:   ['Annual federal requirement','FMCSA compliance'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Fuel System — Fuel Filters',
    keywords:        ['fuel filter','fuel system','low power','hard start','black smoke','injectors','fuel pressure','fuel pump'],
    typical_parts: [
      { description:'Primary Fuel Filter',              part_category:'Filters & Fluids', required:true },
      { description:'Secondary Fuel Filter',            part_category:'Filters & Fluids', required:true },
      { description:'Fuel Water Separator',             part_category:'Filters & Fluids', required:false },
    ],
    labor_hours_min: 0.5,
    labor_hours_max: 1.0,
    common_causes:   ['Scheduled PM interval','Water contamination','Algae growth in fuel tank','Clogged from dirty fuel'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Air Filter Replacement',
    keywords:        ['air filter','air cleaner','intake','restriction indicator','air restriction','intake manifold'],
    typical_parts: [
      { description:'Primary Air Filter Element',       part_category:'Filters & Fluids', required:true },
      { description:'Safety/Secondary Air Filter',      part_category:'Filters & Fluids', required:false },
    ],
    labor_hours_min: 0.3,
    labor_hours_max: 0.5,
    common_causes:   ['Restriction indicator tripped','Scheduled PM','Operating in dusty conditions'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Alternator Replacement',
    keywords:        ['alternator','charging','battery','no charge','low voltage','battery light','electrical','12v','24v'],
    typical_parts: [
      { description:'Alternator — OEM Remanufactured', part_category:'Electrical', required:true },
      { description:'Drive Belt (replace at same time)',part_category:'Engine',    required:true },
      { description:'Battery (test, replace if needed)',part_category:'Electrical',required:false },
    ],
    labor_hours_min: 1.5,
    labor_hours_max: 3.0,
    common_causes:   ['Bearing failure','Diode failure','Belt slip/wear','Overloaded from excess accessories'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Starter Motor Replacement',
    keywords:        ['starter','no start','cranks slow','grinding','starter solenoid','click no start'],
    typical_parts: [
      { description:'Starter Motor — OEM Reman',       part_category:'Electrical', required:true },
      { description:'Starter Solenoid',                part_category:'Electrical', required:false },
      { description:'Battery Cables (inspect)',        part_category:'Electrical', required:false },
    ],
    labor_hours_min: 1.0,
    labor_hours_max: 2.5,
    common_causes:   ['Armature failure','Solenoid contacts worn','Flywheel ring gear damage','Water intrusion'],
    applies_to:      ['all'],
  },
  {
    service_type:    'Fifth Wheel Service',
    keywords:        ['fifth wheel','kingpin','coupling','trailer','fifth wheel grease','slider','locking jaw'],
    typical_parts: [
      { description:'Fifth Wheel Grease — 14oz Tube',  part_category:'Drivetrain', required:true },
      { description:'Kingpin Lock Jaw (if worn)',      part_category:'Drivetrain', required:false },
      { description:'Slider Assembly (if stuck)',      part_category:'Drivetrain', required:false },
    ],
    labor_hours_min: 0.5,
    labor_hours_max: 2.0,
    common_causes:   ['Grease dried out','Locking jaw worn','Slider seized from corrosion'],
    applies_to:      ['all'],
  },
  {
    service_type:    'AC System — Recharge',
    keywords:        ['ac','air conditioning','a/c','not cooling','hot cab','ac recharge','refrigerant','r134a','r-134a'],
    typical_parts: [
      { description:'R-134a Refrigerant — 30lb Cylinder', part_category:'Other', required:true },
      { description:'AC Compressor Oil',                 part_category:'Other', required:false },
      { description:'AC Filter Drier',                   part_category:'Other', required:true },
      { description:'AC Orifice Tube',                   part_category:'Other', required:false },
    ],
    labor_hours_min: 1.0,
    labor_hours_max: 3.0,
    common_causes:   ['Refrigerant leak','Compressor seal failure','Condenser damage','Evaporator core leak'],
    applies_to:      ['all'],
  },
]

// Lookup function — called by AI service writer and parts suggestion API
export function getKBEntry(complaint: string): ServiceKBEntry | null {
  const lower = complaint.toLowerCase()
  let best: { entry: ServiceKBEntry; score: number } | null = null

  for (const entry of PARTS_KB) {
    let score = 0
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score++
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score }
    }
  }

  return best?.entry || null
}

// Get multiple matching entries (for complex complaints)
export function getKBEntries(complaint: string, limit = 3): ServiceKBEntry[] {
  const lower = complaint.toLowerCase()
  const scored: { entry: ServiceKBEntry; score: number }[] = []

  for (const entry of PARTS_KB) {
    let score = 0
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score++
    }
    if (score > 0) scored.push({ entry, score })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.entry)
}
