// ============================================================
// TRUCKZEN — ROLE-BASED ACCESS CONTROL
// Single source of truth for all permissions
// ============================================================

// All modules in the system
export const MODULES = [
  { key: 'dashboard',        label: 'Dashboard',           icon: 'D',  path: '/dashboard' },
  { key: 'kiosk_admin',      label: 'Kiosk',              icon: 'K',  path: '/kiosk-admin' },
  { key: 'orders',           label: 'Work Orders',         icon: 'W',  path: '/work-orders' },
  { key: 'customers',        label: 'Customers',           icon: 'C',  path: '/customers' },
  { key: 'fleet',            label: 'Fleet / Assets',      icon: 'F',  path: '/fleet' },
  { key: 'invoices',         label: 'Invoices',            icon: '$',  path: '/invoices' },
  { key: 'parts',            label: 'Parts Inventory',     icon: 'P',  path: '/parts' },
  { key: 'drivers',          label: 'Drivers',             icon: 'd',  path: '/drivers' },
  { key: 'floor',            label: 'Shop Floor',          icon: 'S',  path: '/shop-floor' },
  { key: 'maintenance',      label: 'Maintenance',         icon: 'M',  path: '/maintenance' },
  { key: 'tires',            label: 'Tire Tracker',        icon: 'T',  path: '/maintenance/tires' },
  { key: 'parts_lifecycle',  label: 'Parts Lifecycle',     icon: 'L',  path: '/maintenance/parts-lifecycle' },
  { key: 'compliance',       label: 'Compliance',          icon: 'c',  path: '/compliance' },
  { key: 'accounting',       label: 'Accounting',          icon: 'A',  path: '/accounting' },
  { key: 'reports',          label: 'Reports',             icon: 'R',  path: '/reports' },
  { key: 'time_tracking',    label: 'Time Tracking',       icon: 't',  path: '/time-tracking' },
  { key: 'settings',         label: 'Settings',            icon: 'G',  path: '/settings' },
  { key: 'import',           label: 'Data Import',         icon: 'I',  path: '/settings/import' },
  { key: 'admin_permissions',label: 'Permissions Admin',   icon: 'X',  path: '/admin/permissions' },
  { key: 'tech_mobile',      label: 'Tech Mobile',         icon: 'm',  path: '/tech' },
  { key: 'dvir',             label: 'DVIR',                icon: 'V',  path: '/dvir' },
  { key: 'billing',          label: 'Billing',             icon: 'B',  path: '/settings/billing' },
  { key: 'integrations',     label: 'Integrations',        icon: 'i',  path: '/settings/integrations' },
  { key: 'audit_log',        label: 'Audit Log',           icon: 'a',  path: '/settings/audit' },
] as const

export type ModuleKey = typeof MODULES[number]['key']

// Default permissions per role
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  owner: Object.fromEntries(MODULES.map(m => [m.key, true])),
  gm:    Object.fromEntries(MODULES.map(m => [m.key, true])),
  it_person: Object.fromEntries(MODULES.map(m => [m.key, true])),

  shop_manager: Object.fromEntries(MODULES.map(m => [m.key, !['billing', 'admin_permissions', 'integrations', 'audit_log'].includes(m.key)])),

  technician: {
    dashboard: false, floor: true, orders: false, invoices: false, customers: false,
    parts: true, fleet: false, drivers: false, maintenance: false, tires: false,
    parts_lifecycle: false, compliance: false, accounting: false, reports: false,
    time_tracking: true, settings: false,
    import: false, admin_permissions: false, tech_mobile: true, dvir: true,
    billing: false, integrations: false, audit_log: false,
  },

  parts_manager: {
    dashboard: true, floor: true, orders: true, invoices: false, customers: false,
    parts: true, fleet: false, drivers: false, maintenance: false, tires: false,
    parts_lifecycle: true, compliance: false, accounting: false, reports: false,
    time_tracking: false, settings: false,
    import: false, admin_permissions: false, tech_mobile: false, dvir: false,
    billing: false, integrations: false, audit_log: false,
  },

  maintenance_manager: {
    dashboard: true, floor: true, orders: false, invoices: false, customers: false,
    parts: true, fleet: true, drivers: false, maintenance: true, tires: true,
    parts_lifecycle: true, compliance: true, accounting: false, reports: true,
    time_tracking: true, settings: false,
    import: false, admin_permissions: false, tech_mobile: false, dvir: true,
    billing: false, integrations: false, audit_log: false,
  },

  maintenance_technician: {
    dashboard: false, floor: true, orders: false, invoices: false, customers: false,
    parts: true, fleet: false, drivers: false, maintenance: true, tires: true,
    parts_lifecycle: true, compliance: false, accounting: false, reports: false,
    time_tracking: true, settings: false,
    import: false, admin_permissions: false, tech_mobile: true, dvir: true,
    billing: false, integrations: false, audit_log: false,
  },

  fleet_manager: {
    dashboard: true, floor: false, orders: false, invoices: false, customers: false,
    parts: false, fleet: true, drivers: true, maintenance: true, tires: true,
    parts_lifecycle: true, compliance: true, accounting: false, reports: true,
    time_tracking: false, settings: false,
    import: false, admin_permissions: false, tech_mobile: false, dvir: true,
    billing: false, integrations: false, audit_log: false,
  },

  accountant: {
    dashboard: true, floor: false, orders: false, invoices: true, customers: false,
    parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
    parts_lifecycle: false, compliance: false, accounting: true, reports: true,
    time_tracking: false, settings: false,
    import: false, admin_permissions: false, tech_mobile: false, dvir: false,
    billing: false, integrations: false, audit_log: false,
  },

  office_admin: {
    dashboard: true, floor: true, orders: true, invoices: true, customers: true,
    parts: true, fleet: false, drivers: false, maintenance: false, tires: false,
    parts_lifecycle: false, compliance: false, accounting: true, reports: true,
    time_tracking: true, settings: true,
    import: true, admin_permissions: false, tech_mobile: false, dvir: false,
    billing: false, integrations: false, audit_log: false,
  },

  service_writer: {
    dashboard: true, floor: true, orders: true, invoices: false, customers: true,
    parts: true, fleet: false, drivers: false, maintenance: false, tires: false,
    parts_lifecycle: false, compliance: false, accounting: false, reports: false,
    time_tracking: false, settings: false,
    import: false, admin_permissions: false, tech_mobile: false, dvir: false,
    billing: false, integrations: false, audit_log: false,
  },

  dispatcher: {
    dashboard: true, floor: true, orders: false, invoices: false, customers: false,
    parts: false, fleet: true, drivers: true, maintenance: false, tires: false,
    parts_lifecycle: false, compliance: false, accounting: false, reports: false,
    time_tracking: false, settings: false,
    import: false, admin_permissions: false, tech_mobile: false, dvir: false,
    billing: false, integrations: false, audit_log: false,
  },

  driver: {
    dashboard: false, floor: false, orders: false, invoices: false, customers: false,
    parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
    parts_lifecycle: false, compliance: false, accounting: false, reports: false,
    time_tracking: false, settings: false,
    import: false, admin_permissions: false, tech_mobile: false, dvir: true,
    billing: false, integrations: false, audit_log: false,
  },

  customer: {
    dashboard: false, floor: false, orders: false, invoices: false, customers: false,
    parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
    parts_lifecycle: false, compliance: false, accounting: false, reports: false,
    time_tracking: false, settings: false,
    import: false, admin_permissions: false, tech_mobile: false, dvir: false,
    billing: false, integrations: false, audit_log: false,
  },
}

// Role redirect after login
export const ROLE_REDIRECT: Record<string, string> = {
  owner: '/dashboard', gm: '/dashboard', it_person: '/dashboard',
  shop_manager: '/dashboard', service_writer: '/orders',
  technician: '/tech', parts_manager: '/parts', fleet_manager: '/fleet',
  maintenance_manager: '/maintenance', maintenance_technician: '/tech',
  accountant: '/accounting', office_admin: '/dashboard', dispatcher: '/fleet',
  driver: '/dvir', customer: '/portal',
}

// Role labels and colors
export const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', gm: 'GM', it_person: 'IT Admin', shop_manager: 'Shop Manager',
  service_writer: 'Service Writer', technician: 'Technician',
  parts_manager: 'Parts Dept', fleet_manager: 'Fleet Manager', maintenance_manager: 'Maint. Manager',
  maintenance_technician: 'Maint. Tech', accountant: 'Accounting', office_admin: 'Office Admin',
  dispatcher: 'Dispatcher', driver: 'Driver', customer: 'Customer',
}

export const ROLE_COLOR: Record<string, string> = {
  owner: '#D94F4F', gm: '#D94F4F', it_person: '#D94F4F', shop_manager: '#D4882A',
  service_writer: '#4D9EFF', technician: '#1DB870',
  parts_manager: '#8B5CF6', fleet_manager: '#0E9F8E', maintenance_manager: '#0E9F8E',
  maintenance_technician: '#1DB870', accountant: '#E8692A', office_admin: '#D4882A',
  dispatcher: '#0E9F8E', driver: '#7C8BA0',
}

// All roles in display order
export const ALL_ROLES = [
  'owner', 'gm', 'it_person', 'shop_manager', 'service_writer',
  'technician', 'parts_manager', 'fleet_manager', 'maintenance_manager',
  'maintenance_technician', 'accountant', 'office_admin', 'dispatcher', 'driver',
]

// Path → module key mapping
export function pathToModule(path: string): string | null {
  // Check most specific paths first
  if (path.startsWith('/maintenance/tires')) return 'tires'
  if (path.startsWith('/maintenance/parts-lifecycle')) return 'parts_lifecycle'
  if (path.startsWith('/settings/import')) return 'import'
  if (path.startsWith('/settings/billing')) return 'billing'
  if (path.startsWith('/settings/integrations')) return 'integrations'
  if (path.startsWith('/settings/audit')) return 'audit_log'
  if (path.startsWith('/admin/permissions')) return 'admin_permissions'
  if (path.startsWith('/admin/roles-guide')) return 'admin_permissions'
  if (path.startsWith('/tech')) return 'tech_mobile'

  // General paths
  for (const m of MODULES) {
    if (m.path === '/' + path.split('/')[1] || path.startsWith(m.path)) return m.key
  }
  return null
}

// Check if a role has access to a module, considering overrides
export function hasAccess(
  role: string,
  module: string,
  rolePerms?: Record<string, boolean>,
  userOverrides?: Record<string, boolean>
): boolean {
  // User-level override takes highest priority
  if (userOverrides && module in userOverrides) return userOverrides[module]
  // Custom role permissions from DB
  if (rolePerms && module in rolePerms) return rolePerms[module]
  // Fall back to defaults
  return DEFAULT_ROLE_PERMISSIONS[role]?.[module] ?? false
}

// Sidebar nav items derived from modules
export function getSidebarItems(role: string, rolePerms?: Record<string, boolean>, userOverrides?: Record<string, boolean>) {
  const sidebarModules = [
    'dashboard', 'floor', 'orders', 'invoices', 'parts', 'fleet',
    'maintenance', 'customers', 'accounting', 'reports',
    'time_tracking', 'settings',
  ]

  return sidebarModules
    .filter(key => hasAccess(role, key, rolePerms, userOverrides))
    .map(key => {
      const m = MODULES.find(mod => mod.key === key)!
      return { label: m.label, href: m.path, icon: m.icon, key: m.key }
    })
}
