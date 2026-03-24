import * as XLSX from 'xlsx'

export interface StaffRow {
  full_name: string
  email: string
  phone?: string
  role: string
  department?: string
  language: string
  employee_id?: string
  skills?: string
  team?: string
  start_date?: string
  notes?: string
  _status?: 'valid' | 'warning' | 'error'
  _errors?: string[]
  _warnings?: string[]
}

const ROLE_MAP: Record<string, string> = {
  'mechanic': 'technician',
  'technician': 'technician',
  'tech': 'technician',
  'service writer': 'service_writer',
  'servicewriter': 'service_writer',
  'writer': 'service_writer',
  'floor manager': 'shop_manager',
  'floormanager': 'shop_manager',
  'shop manager': 'shop_manager',
  'supervisor': 'shop_manager',
  'parts manager': 'parts_manager',
  'partsmanager': 'parts_manager',
  'parts staff': 'parts_manager',
  'parts': 'parts_manager',
  'accounting': 'accountant',
  'accountant': 'accountant',
  'office admin': 'office_admin',
  'office_admin': 'office_admin',
  'admin': 'office_admin',
  'dispatcher': 'dispatcher',
  'driver': 'driver',
  'fleet manager': 'fleet_manager',
  'maintenance technician': 'maintenance_technician',
  'maintenance_technician': 'maintenance_technician',
  'maintenance manager': 'maintenance_manager',
  'gm': 'gm',
  'general manager': 'gm',
  'owner': 'owner',
}

const VALID_ROLES = [
  'technician', 'maintenance_technician', 'maintenance_manager',
  'service_writer', 'accountant', 'office_admin', 'shop_manager', 'gm',
  'parts_manager', 'fleet_manager', 'dispatcher', 'driver', 'owner',
]

const LANG_MAP: Record<string, string> = {
  'en': 'en', 'english': 'en',
  'ru': 'ru', 'russian': 'ru', 'русский': 'ru',
  'uk': 'uk', 'ukrainian': 'uk', 'українська': 'uk',
  'es': 'es', 'spanish': 'es', 'español': 'es',
  'uz': 'uz', 'uzbek': 'uz', "o'zbek": 'uz',
}

export function parseStaffFile(buffer: ArrayBuffer): StaffRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][]

  // Find header row (skip title/subtitle rows)
  let headerRow = -1
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const row = (raw[i] || []).map(c => String(c || '').toLowerCase())
    if (row.some(cell => cell.includes('name') || cell.includes('email'))) {
      headerRow = i
      break
    }
  }
  if (headerRow === -1) throw new Error('Could not find header row. Make sure the file has a row with "Name" and "Email" columns.')

  const headers = raw[headerRow].map(h => String(h || '').toLowerCase().trim())
  const rows = raw.slice(headerRow + 1).filter(row => row.some(cell => cell != null && String(cell).trim() !== ''))

  return rows.map(row => {
    const get = (keys: string[]) => {
      for (const key of keys) {
        const idx = headers.findIndex(h => h.includes(key))
        if (idx >= 0 && row[idx] != null) return String(row[idx]).trim()
      }
      return ''
    }

    const rawRole = get(['role']).toLowerCase()
    const rawLang = get(['language', 'lang']).toLowerCase()

    const staff: StaffRow = {
      full_name: get(['full name', 'name']),
      email: get(['email']),
      phone: get(['phone']),
      role: ROLE_MAP[rawRole] || rawRole,
      department: get(['department', 'dept']),
      language: LANG_MAP[rawLang] || rawLang || 'en',
      employee_id: get(['employee id', 'emp id', 'employee_id']),
      skills: get(['skills', 'specialties', 'certifications']),
      team: get(['team']),
      start_date: get(['start', 'hire']),
      notes: get(['notes', 'comment']),
      _errors: [],
      _warnings: [],
    }

    // Validate
    if (!staff.full_name) staff._errors!.push('Missing full name')
    if (!staff.email) staff._errors!.push('Missing email')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staff.email)) staff._errors!.push('Invalid email format')
    if (!staff.role || !VALID_ROLES.includes(staff.role)) staff._errors!.push(`Unknown role: "${rawRole || '(empty)'}"`)
    if (!staff.language || !Object.values(LANG_MAP).includes(staff.language)) staff._warnings!.push('Unknown language — will default to English')
    if (!staff.team && ['technician', 'maintenance_technician', 'maintenance_manager'].includes(staff.role)) {
      staff._warnings!.push('No team assigned for floor role')
    }

    staff._status = staff._errors!.length > 0 ? 'error' : staff._warnings!.length > 0 ? 'warning' : 'valid'

    return staff
  })
}

export function generateTemplate(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const headers = ['Full Name', 'Email', 'Role', 'Team', 'Language', 'Phone', 'Skills', 'Employee ID', 'Notes']
  const example = [
    ['Carlos Martinez', 'carlos@ugltrucks.com', 'Technician', 'A', 'English', '555-0101', 'Engine, Diagnostics, Brakes', 'EMP-001', ''],
    ['Aziz Karimov', 'aziz@ugltrucks.com', 'Technician', 'B', 'Uzbek', '555-0102', 'Electrical, AC', 'EMP-002', ''],
    ['Maria Lopez', 'maria@ugltrucks.com', 'Service Writer', '', 'Spanish', '555-0103', '', 'EMP-003', ''],
    ['Dmitry Petrov', 'dmitry@ugltrucks.com', 'Parts Manager', '', 'Russian', '555-0104', '', 'EMP-004', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example])
  ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 22 }, { wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Staff Roster')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}
