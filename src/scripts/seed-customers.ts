import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env.local
const envFile = readFileSync('.env.local', 'utf-8')
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SHOP_ID = '1f927e3e-4fe5-431a-bb7c-dac77501e892'

function vin(prefix: string): string {
  const chars = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ' // no I, O, Q
  let v = prefix
  while (v.length < 17) v += chars[Math.floor(Math.random() * chars.length)]
  return v.slice(0, 17)
}

function miles(min: number, max: number) { return Math.floor(Math.random() * (max - min) + min) }

interface Contact {
  name: string
  role: string
  is_primary: boolean
}

interface Unit {
  unit_number: string
  year: number
  make: string
  model: string
  vin_prefix: string
  unit_type: string
  odometer: number
}

interface Customer {
  company_name: string
  dot_number: string
  mc_number: string
  phone: string
  payment_terms: string
  contact_name: string
  contacts: Contact[]
  units: Unit[]
}

function truck(unit_number: string, year: number, make: string, model: string, vin_prefix: string): Unit {
  return { unit_number, year, make, model, vin_prefix, unit_type: 'tractor', odometer: miles(100000, 950000) }
}

function trailer(unit_number: string, year: number, make: string, model: string, vin_prefix: string, unit_type: string): Unit {
  return { unit_number, year, make, model, vin_prefix, unit_type, odometer: miles(50000, 400000) }
}

const customers: Customer[] = [
  // 1. Highway Trucking Services
  {
    company_name: 'Highway Trucking Services',
    dot_number: '3284756',
    mc_number: '1045832',
    phone: '(725) 600-1090',
    payment_terms: 'cod',
    contact_name: 'Sarvar Rahimov',
    contacts: [
      { name: 'Sarvar Rahimov', role: 'Owner', is_primary: true },
      { name: 'Ahmad Yusupov', role: 'Dispatcher', is_primary: false },
    ],
    units: [
      truck('744', 2021, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1439', 2023, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('892', 2020, 'Kenworth', 'T680', '1XKYD49X'),
      truck('1102', 2022, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('556', 2019, 'Peterbilt', '579', '1XPBD49X'),
      truck('2001', 2024, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('331', 2021, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('1677', 2022, 'Kenworth', 'T680', '1XKYD49X'),
      truck('990', 2020, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('445', 2023, 'Peterbilt', '579', '1XPBD49X'),
      truck('1200', 2024, 'Volvo', 'VNL860', '4V4NC9EH'),
      truck('678', 2021, 'Kenworth', 'W990', '1XKYD49X'),
      truck('2100', 2023, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('815', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1560', 2024, 'Kenworth', 'T680', '1XKYD49X'),
      trailer('TR-101', 2020, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-102', 2021, 'Great Dane', 'Reefer 53ft', '1GRN5232', 'trailer_reefer'),
      trailer('TR-103', 2019, 'Wabash', 'Flatbed 48ft', '1JJV532D', 'trailer_flatbed'),
      trailer('TR-104', 2022, 'Hyundai', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-105', 2023, 'Vanguard', 'Reefer 53ft', '1UYVS253', 'trailer_reefer'),
    ],
  },

  // 2. Uscan Logistics Inc
  {
    company_name: 'Uscan Logistics Inc',
    dot_number: '4102938',
    mc_number: '1198234',
    phone: '(630) 555-0187',
    payment_terms: 'net30',
    contact_name: 'Hamed Aliyev',
    contacts: [
      { name: 'Hamed Aliyev', role: 'Owner', is_primary: true },
      { name: 'Nate Kish', role: 'Fleet Manager', is_primary: false },
    ],
    units: [
      truck('1400', 2021, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1401', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1402', 2020, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1403', 2023, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1404', 2024, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1405', 2019, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1406', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1407', 2023, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1408', 2021, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1409', 2024, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1410', 2020, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('1411', 2022, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('1412', 2023, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('1413', 2021, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('1414', 2024, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('1415', 2020, 'Kenworth', 'T680', '1XKYD49X'),
      truck('1416', 2022, 'Kenworth', 'T680', '1XKYD49X'),
      truck('1417', 2023, 'Kenworth', 'T680', '1XKYD49X'),
      truck('1418', 2021, 'Kenworth', 'T680', '1XKYD49X'),
      truck('1419', 2024, 'Kenworth', 'T680', '1XKYD49X'),
      trailer('TR-201', 2021, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-202', 2022, 'Great Dane', 'Dry Van 53ft', '1GRN5232', 'trailer_dry_van'),
      trailer('TR-203', 2020, 'Wabash', 'Dry Van 53ft', '1JJV532D', 'trailer_dry_van'),
      trailer('TR-204', 2023, 'Hyundai', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-205', 2021, 'Vanguard', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-206', 2022, 'Great Dane', 'Reefer 53ft', '1GRN5232', 'trailer_reefer'),
      trailer('TR-207', 2023, 'Utility', 'Reefer 53ft', '1UYVS253', 'trailer_reefer'),
      trailer('TR-208', 2024, 'Vanguard', 'Reefer 53ft', '1UYVS253', 'trailer_reefer'),
    ],
  },

  // 3. Fair and Fast Logistics Inc
  {
    company_name: 'Fair and Fast Logistics Inc',
    dot_number: '3891045',
    mc_number: '1087456',
    phone: '(312) 555-0234',
    payment_terms: 'cod',
    contact_name: 'Bakhodir Karimov',
    contacts: [
      { name: 'Bakhodir Karimov', role: 'Owner', is_primary: true },
      { name: 'Jamshid Umarov', role: 'Dispatcher', is_primary: false },
    ],
    units: [
      truck('3010', 2021, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('3011', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('3012', 2020, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('3013', 2023, 'Kenworth', 'T680', '1XKYD49X'),
      truck('3014', 2019, 'Peterbilt', '579', '1XPBD49X'),
      truck('3015', 2024, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('3016', 2021, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('3017', 2022, 'Kenworth', 'T680', '1XKYD49X'),
      truck('3018', 2023, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('3019', 2020, 'Peterbilt', '579', '1XPBD49X'),
      truck('3020', 2024, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('3021', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      trailer('TR-301', 2021, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-302', 2022, 'Great Dane', 'Reefer 53ft', '1GRN5232', 'trailer_reefer'),
      trailer('TR-303', 2020, 'Wabash', 'Flatbed 48ft', '1JJV532D', 'trailer_flatbed'),
      trailer('TR-304', 2023, 'Hyundai', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
    ],
  },

  // 4. Barru Group
  {
    company_name: 'Barru Group',
    dot_number: '2987612',
    mc_number: '1156789',
    phone: '(847) 555-0345',
    payment_terms: 'net15',
    contact_name: 'Frank Barrutia',
    contacts: [
      { name: 'Frank Barrutia', role: 'Owner', is_primary: true },
    ],
    units: [
      truck('4010', 2021, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('4011', 2023, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('4012', 2020, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('4013', 2022, 'Kenworth', 'T680', '1XKYD49X'),
      truck('4014', 2019, 'Peterbilt', '579', '1XPBD49X'),
      truck('4015', 2024, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('4016', 2021, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('4017', 2023, 'Kenworth', 'T680', '1XKYD49X'),
      trailer('TR-401', 2021, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-402', 2022, 'Great Dane', 'Reefer 53ft', '1GRN5232', 'trailer_reefer'),
      trailer('TR-403', 2020, 'Wabash', 'Flatbed 48ft', '1JJV532D', 'trailer_flatbed'),
    ],
  },

  // 5. RDZ Trucking LLC
  {
    company_name: 'RDZ Trucking LLC',
    dot_number: '5012387',
    mc_number: '1234567',
    phone: '(708) 555-0456',
    payment_terms: 'cod',
    contact_name: 'Rustam Zakirov',
    contacts: [
      { name: 'Rustam Zakirov', role: 'Owner', is_primary: true },
    ],
    units: [
      truck('5010', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('5011', 2023, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('5012', 2021, 'Kenworth', 'T680', '1XKYD49X'),
      truck('5013', 2024, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      trailer('TR-501', 2022, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-502', 2023, 'Great Dane', 'Reefer 53ft', '1GRN5232', 'trailer_reefer'),
    ],
  },

  // 6. Al-Amin Express Inc
  {
    company_name: 'Al-Amin Express Inc',
    dot_number: '4456789',
    mc_number: '1298765',
    phone: '(773) 555-0567',
    payment_terms: 'net30',
    contact_name: 'Mohammed Al-Amin',
    contacts: [
      { name: 'Mohammed Al-Amin', role: 'Owner', is_primary: true },
      { name: 'Yusuf Ibrahim', role: 'Maintenance Manager', is_primary: false },
    ],
    units: [
      truck('6010', 2021, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('6011', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('6012', 2020, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('6013', 2023, 'Kenworth', 'T680', '1XKYD49X'),
      truck('6014', 2019, 'Peterbilt', '579', '1XPBD49X'),
      truck('6015', 2024, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('6016', 2021, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('6017', 2022, 'Kenworth', 'T680', '1XKYD49X'),
      truck('6018', 2023, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('6019', 2024, 'Peterbilt', '579', '1XPBD49X'),
      trailer('TR-601', 2021, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-602', 2022, 'Great Dane', 'Reefer 53ft', '1GRN5232', 'trailer_reefer'),
      trailer('TR-603', 2020, 'Wabash', 'Flatbed 48ft', '1JJV532D', 'trailer_flatbed'),
      trailer('TR-604', 2023, 'Hyundai', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-605', 2021, 'Vanguard', 'Reefer 53ft', '1UYVS253', 'trailer_reefer'),
      trailer('TR-606', 2024, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
    ],
  },

  // 7. Nurota Inc
  {
    company_name: 'Nurota Inc',
    dot_number: '3345678',
    mc_number: '1167890',
    phone: '(630) 555-0678',
    payment_terms: 'cod',
    contact_name: 'Dilshod Nurmatov',
    contacts: [
      { name: 'Dilshod Nurmatov', role: 'Owner', is_primary: true },
    ],
    units: [
      truck('7010', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('7011', 2023, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('7012', 2021, 'Kenworth', 'T680', '1XKYD49X'),
      truck('7013', 2024, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('7014', 2020, 'Peterbilt', '579', '1XPBD49X'),
      truck('7015', 2022, 'Volvo', 'VNL', '4V4NC9EH'),
      trailer('TR-701', 2022, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-702', 2023, 'Great Dane', 'Reefer 53ft', '1GRN5232', 'trailer_reefer'),
    ],
  },

  // 8. Lion's Head Transport
  {
    company_name: "Lion's Head Transport",
    dot_number: '2876543',
    mc_number: '1078654',
    phone: '(815) 555-0789',
    payment_terms: 'net30',
    contact_name: 'Leo Simmons',
    contacts: [
      { name: 'Leo Simmons', role: 'Owner', is_primary: true },
      { name: 'Tracy Simmons', role: 'Accounting', is_primary: false },
    ],
    units: [
      truck('8010', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('8011', 2023, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('8012', 2024, 'Kenworth', 'T680', '1XKYD49X'),
      trailer('TR-801', 2022, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
    ],
  },

  // 9. Dadakhon Trans Corp
  {
    company_name: 'Dadakhon Trans Corp',
    dot_number: '5234567',
    mc_number: '1345678',
    phone: '(847) 555-0890',
    payment_terms: 'cod',
    contact_name: 'Dadakhon Rakhimov',
    contacts: [
      { name: 'Dadakhon Rakhimov', role: 'Owner', is_primary: true },
    ],
    units: [
      truck('9010', 2023, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('9011', 2024, 'Volvo', 'VNL', '4V4NC9EH'),
    ],
  },

  // 10. KG Road Inc
  {
    company_name: 'KG Road Inc',
    dot_number: '4678901',
    mc_number: '1256789',
    phone: '(708) 555-0901',
    payment_terms: 'net15',
    contact_name: 'Kubanychbek Asanov',
    contacts: [
      { name: 'Kubanychbek Asanov', role: 'Owner', is_primary: true },
      { name: 'Aisuluu Toktoeva', role: 'Dispatcher', is_primary: false },
    ],
    units: [
      truck('1010', 2022, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      truck('1011', 2023, 'Volvo', 'VNL', '4V4NC9EH'),
      truck('1012', 2021, 'Kenworth', 'T680', '1XKYD49X'),
      truck('1013', 2024, 'Peterbilt', '579', '1XPBD49X'),
      truck('1014', 2020, 'Freightliner', 'Cascadia', '3AKJHHDR'),
      trailer('TR-1001', 2022, 'Utility', 'Dry Van 53ft', '1UYVS253', 'trailer_dry_van'),
      trailer('TR-1002', 2023, 'Great Dane', 'Reefer 53ft', '1GRN5232', 'trailer_reefer'),
      trailer('TR-1003', 2021, 'Wabash', 'Flatbed 48ft', '1JJV532D', 'trailer_flatbed'),
    ],
  },
]

async function main() {
  const s = createClient(SUPABASE_URL, SERVICE_KEY)

  let totalCustomers = 0
  let totalContacts = 0
  let totalUnits = 0

  for (const cust of customers) {
    // Insert customer
    const { data: c, error: custErr } = await s.from('customers').insert({
      shop_id: SHOP_ID,
      company_name: cust.company_name,
      contact_name: cust.contact_name,
      phone: cust.phone,
      email: 'kenanagasiyev@gmail.com',
      dot_number: cust.dot_number,
      mc_number: cust.mc_number,
      payment_terms: cust.payment_terms,
      source: 'walk_in',
    }).select().single()

    if (custErr) {
      console.error(`Failed to create customer "${cust.company_name}":`, custErr.message)
      continue
    }
    console.log(`Created customer: ${c.company_name} (${c.id})`)
    totalCustomers++

    // Insert contacts
    for (const contact of cust.contacts) {
      const { error: contactErr } = await s.from('customer_contacts').insert({
        customer_id: c.id,
        shop_id: SHOP_ID,
        full_name: contact.name,
        role: contact.role,
        is_primary: contact.is_primary,
        email: 'kenanagasiyev@gmail.com',
        phone: cust.phone,
      })
      if (contactErr) {
        console.error(`  Failed to create contact "${contact.name}":`, contactErr.message)
      } else {
        console.log(`  Contact: ${contact.name} (${contact.role})`)
        totalContacts++
      }
    }

    // Insert units
    for (const unit of cust.units) {
      const { error: unitErr } = await s.from('assets').insert({
        shop_id: SHOP_ID,
        customer_id: c.id,
        unit_number: unit.unit_number,
        vin: vin(unit.vin_prefix),
        year: unit.year,
        make: unit.make,
        model: unit.model,
        odometer: unit.odometer,
        unit_type: unit.unit_type,
        ownership_type: 'fleet_asset',
        status: 'on_road',
      })
      if (unitErr) {
        console.error(`  Failed to create unit "${unit.unit_number}":`, unitErr.message)
      } else {
        console.log(`  Unit: ${unit.unit_number} — ${unit.year} ${unit.make} ${unit.model}`)
        totalUnits++
      }
    }
  }

  console.log('\n--- Seed Summary ---')
  console.log(`Customers created: ${totalCustomers}`)
  console.log(`Contacts created:  ${totalContacts}`)
  console.log(`Units created:     ${totalUnits}`)
}

main()
