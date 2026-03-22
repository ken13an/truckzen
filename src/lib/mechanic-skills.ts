/**
 * TruckZen — Original Design
 * Mechanic skills catalog + auto-suggest assignment scoring
 */

export const SKILL_CATALOG: Record<string, string[]> = {
  'Engine & Drivetrain': [
    'Engine diagnostics', 'Engine rebuild/overhaul', 'Turbocharger repair',
    'Fuel system repair', 'Cooling system repair', 'Exhaust/DPF/EGR/aftertreatment',
    'Transmission repair', 'Clutch replacement', 'Driveline/driveshaft',
  ],
  'Brakes & Suspension': [
    'Air brake repair', 'Brake drums/shoes', 'Brake disc/pad', 'ABS diagnostics',
    'Suspension repair', 'Leaf springs', 'Air ride/air bags', 'Alignment', 'Bushings',
  ],
  'Electrical': [
    'Electrical diagnostics', 'Wiring harness repair', 'Lighting systems',
    'Starter/alternator', 'Battery systems', 'ECM/ECU programming', 'Sensor diagnostics',
  ],
  'Body & Chassis': [
    'Body work', 'Doors/hinges', 'Windshield replacement', 'Frame repair',
    'Fifth wheel repair', 'Cab mount', 'Fender/hood',
  ],
  'Tires & Wheels': [
    'Tire mounting/balancing', 'Tire repair', 'Wheel seal replacement',
    'Hub/bearing replacement', 'Lug nut/stud repair',
  ],
  'HVAC & Comfort': ['AC repair', 'Heater repair', 'APU service'],
  'Preventive Maintenance': [
    'Oil change / PM service', 'DOT inspection', 'Annual inspection',
    'Pre-trip/post-trip inspection',
  ],
  'Diagnostics & Technology': [
    'Computer diagnostics (laptop-based)', 'Fault code reading',
    'Telematics/GPS systems', 'Emissions systems',
  ],
  'Specialty': [
    'Welding', 'Hydraulics', 'Reefer/refrigeration unit', 'Liftgate repair', 'PTO systems',
  ],
}

// Keyword → skill category mapping for job description analysis
const JOB_KEYWORD_MAP: Record<string, string> = {
  'oil change': 'Preventive Maintenance', 'pm service': 'Preventive Maintenance', 'pm': 'Preventive Maintenance',
  'dot inspection': 'Preventive Maintenance', 'annual inspection': 'Preventive Maintenance',
  'brake': 'Brakes & Suspension', 'drum': 'Brakes & Suspension', 'abs': 'Brakes & Suspension',
  'suspension': 'Brakes & Suspension', 'spring': 'Brakes & Suspension', 'shock': 'Brakes & Suspension',
  'alignment': 'Brakes & Suspension', 'bushing': 'Brakes & Suspension',
  'engine': 'Engine & Drivetrain', 'motor': 'Engine & Drivetrain', 'overhaul': 'Engine & Drivetrain',
  'turbo': 'Engine & Drivetrain', 'fuel': 'Engine & Drivetrain', 'coolant': 'Engine & Drivetrain',
  'cooling': 'Engine & Drivetrain', 'radiator': 'Engine & Drivetrain',
  'exhaust': 'Engine & Drivetrain', 'dpf': 'Engine & Drivetrain', 'egr': 'Engine & Drivetrain',
  'aftertreatment': 'Engine & Drivetrain', 'def': 'Engine & Drivetrain',
  'transmission': 'Engine & Drivetrain', 'clutch': 'Engine & Drivetrain', 'driveshaft': 'Engine & Drivetrain',
  'electrical': 'Electrical', 'wiring': 'Electrical', 'harness': 'Electrical',
  'starter': 'Electrical', 'alternator': 'Electrical', 'battery': 'Electrical',
  'ecm': 'Electrical', 'sensor': 'Electrical', 'light': 'Electrical',
  'body': 'Body & Chassis', 'door': 'Body & Chassis', 'windshield': 'Body & Chassis',
  'fender': 'Body & Chassis', 'hood': 'Body & Chassis', 'cab mount': 'Body & Chassis',
  'fifth wheel': 'Body & Chassis', 'frame': 'Body & Chassis', 'mirror': 'Body & Chassis',
  'tire': 'Tires & Wheels', 'wheel': 'Tires & Wheels', 'hub': 'Tires & Wheels',
  'bearing': 'Tires & Wheels', 'lug': 'Tires & Wheels',
  'ac': 'HVAC & Comfort', 'a/c': 'HVAC & Comfort', 'heater': 'HVAC & Comfort', 'apu': 'HVAC & Comfort',
  'diagnostic': 'Diagnostics & Technology', 'code': 'Diagnostics & Technology',
  'check engine': 'Diagnostics & Technology', 'scan': 'Diagnostics & Technology',
  'welding': 'Specialty', 'weld': 'Specialty', 'hydraulic': 'Specialty',
  'reefer': 'Specialty', 'liftgate': 'Specialty', 'pto': 'Specialty',
}

export function getJobCategories(jobDescription: string): string[] {
  if (!jobDescription) return []
  const lower = jobDescription.toLowerCase()
  const categories = new Set<string>()
  for (const [keyword, category] of Object.entries(JOB_KEYWORD_MAP)) {
    if (lower.includes(keyword)) categories.add(category)
  }
  return Array.from(categories)
}

const EXP_SCORES: Record<string, number> = { expert: 30, experienced: 20, intermediate: 10, beginner: 5 }

export interface MechanicScore {
  user_id: string
  name: string
  score: number
  matchingSkills: { skill: string; level: string; certified: boolean }[]
  status: 'available' | 'on_job' | 'off_today'
  jobsInQueue: number
  isBestMatch: boolean
}

export function scoreMechanics(
  jobDescription: string,
  mechanics: { id: string; full_name: string }[],
  allSkills: { user_id: string; skill_name: string; skill_category: string; experience_level: string; certified: boolean }[],
  activeClocks: { user_id: string }[],
  jobQueues: Record<string, number>,
): MechanicScore[] {
  const categories = getJobCategories(jobDescription)

  const scores: MechanicScore[] = mechanics.map(mech => {
    const mechSkills = allSkills.filter(s => s.user_id === mech.id)
    let skillMatch = 0
    let expBonus = 0
    const matchingSkills: MechanicScore['matchingSkills'] = []

    for (const cat of categories) {
      // Check for exact skill match in this category
      const catSkills = mechSkills.filter(s => s.skill_category === cat)
      if (catSkills.length > 0) {
        // Best skill in this category
        const best = catSkills.sort((a, b) => (EXP_SCORES[b.experience_level] || 0) - (EXP_SCORES[a.experience_level] || 0))[0]
        skillMatch = Math.max(skillMatch, 40)
        expBonus = Math.max(expBonus, EXP_SCORES[best.experience_level] || 10)
        if (best.certified) expBonus += 10
        matchingSkills.push({ skill: best.skill_name, level: best.experience_level, certified: best.certified })
      } else {
        // Check if they have ANY skills (same category = 25)
        skillMatch = Math.max(skillMatch, 0)
      }
    }

    // If no category matched but mechanic has many skills, give partial credit
    if (categories.length === 0 && mechSkills.length > 0) {
      skillMatch = 15 // generic assignment
    }

    // Availability
    const isClockedIn = activeClocks.some(c => c.user_id === mech.id)
    const availBonus = isClockedIn ? 10 : -50 // simplified: clocked in = at work
    const status: MechanicScore['status'] = isClockedIn ? 'on_job' : 'off_today'

    // Workload
    const queueCount = jobQueues[mech.id] || 0
    const workloadBonus = queueCount === 0 ? 10 : queueCount <= 2 ? 7 : queueCount <= 4 ? 4 : 0

    const score = skillMatch + expBonus + availBonus + workloadBonus

    return {
      user_id: mech.id,
      name: mech.full_name,
      score: Math.max(0, score),
      matchingSkills,
      status,
      jobsInQueue: queueCount,
      isBestMatch: false,
    }
  })

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score)
  if (scores.length > 0) scores[0].isBestMatch = true

  return scores
}

// Skill templates for bulk onboarding
export const SKILL_TEMPLATES: Record<string, { skills: { name: string; category: string; level: string }[] }> = {
  'General Mechanic': {
    skills: [
      { name: 'Oil change / PM service', category: 'Preventive Maintenance', level: 'intermediate' },
      { name: 'Brake drums/shoes', category: 'Brakes & Suspension', level: 'intermediate' },
      { name: 'Tire mounting/balancing', category: 'Tires & Wheels', level: 'intermediate' },
      { name: 'Electrical diagnostics', category: 'Electrical', level: 'intermediate' },
      { name: 'DOT inspection', category: 'Preventive Maintenance', level: 'intermediate' },
    ],
  },
  'Engine Specialist': {
    skills: [
      ...['Engine diagnostics', 'Engine rebuild/overhaul', 'Turbocharger repair', 'Fuel system repair', 'Cooling system repair', 'Exhaust/DPF/EGR/aftertreatment', 'Transmission repair', 'Clutch replacement', 'Driveline/driveshaft'].map(s => ({ name: s, category: 'Engine & Drivetrain', level: 'experienced' })),
      { name: 'Computer diagnostics (laptop-based)', category: 'Diagnostics & Technology', level: 'experienced' },
      { name: 'Fault code reading', category: 'Diagnostics & Technology', level: 'experienced' },
    ],
  },
  'Body Shop Tech': {
    skills: [
      ...['Body work', 'Doors/hinges', 'Windshield replacement', 'Frame repair', 'Fifth wheel repair', 'Cab mount', 'Fender/hood'].map(s => ({ name: s, category: 'Body & Chassis', level: 'experienced' })),
      { name: 'Welding', category: 'Specialty', level: 'experienced' },
    ],
  },
  'Tire Tech': {
    skills: [
      ...['Tire mounting/balancing', 'Tire repair', 'Wheel seal replacement', 'Hub/bearing replacement', 'Lug nut/stud repair'].map(s => ({ name: s, category: 'Tires & Wheels', level: 'experienced' })),
      { name: 'Alignment', category: 'Brakes & Suspension', level: 'experienced' },
    ],
  },
  'PM Technician': {
    skills: [
      { name: 'Oil change / PM service', category: 'Preventive Maintenance', level: 'expert' },
      { name: 'DOT inspection', category: 'Preventive Maintenance', level: 'experienced' },
      { name: 'Annual inspection', category: 'Preventive Maintenance', level: 'experienced' },
      { name: 'Pre-trip/post-trip inspection', category: 'Preventive Maintenance', level: 'experienced' },
    ],
  },
  'Lead/Senior Mechanic': {
    skills: [
      { name: 'Engine diagnostics', category: 'Engine & Drivetrain', level: 'expert' },
      { name: 'Air brake repair', category: 'Brakes & Suspension', level: 'expert' },
      { name: 'Electrical diagnostics', category: 'Electrical', level: 'expert' },
      { name: 'Computer diagnostics (laptop-based)', category: 'Diagnostics & Technology', level: 'expert' },
      { name: 'Oil change / PM service', category: 'Preventive Maintenance', level: 'expert' },
      { name: 'DOT inspection', category: 'Preventive Maintenance', level: 'expert' },
      { name: 'Transmission repair', category: 'Engine & Drivetrain', level: 'experienced' },
      { name: 'AC repair', category: 'HVAC & Comfort', level: 'experienced' },
      { name: 'Welding', category: 'Specialty', level: 'experienced' },
    ],
  },
}
