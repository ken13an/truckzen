// ============================================================
// TRUCKZEN — CONFIG-DRIVEN ROLE DEFINITIONS
// Single source of truth for roles, sidebar, and permissions
// ============================================================

export type RoleKey =
  | 'owner'
  | 'gm'
  | 'it_person'
  | 'shop_manager'
  | 'service_writer'
  | 'technician'
  | 'lead_tech'
  | 'parts_manager'
  | 'fleet_manager'
  | 'maintenance_manager'
  | 'maintenance_technician'
  | 'accountant'
  | 'office_admin'
  | 'dispatcher'
  | 'driver'
  | 'customer'

export interface SidebarItem {
  label: string
  href: string
  icon: string
  key: string
}

export interface RoleConfig {
  label: string
  redirectTo: string
  sidebar: SidebarItem[]
  permissions: Record<string, boolean>
}

// ---- Sidebar item definitions ----

const SIDEBAR_ITEMS: Record<string, SidebarItem> = {
  dashboard:     { label: 'Dashboard',       href: '/dashboard',       icon: 'D', key: 'dashboard' },
  kiosk:         { label: 'Kiosk',           href: '/kiosk-admin',     icon: 'K', key: 'kiosk_admin' },
  work_orders:   { label: 'Work Orders',     href: '/work-orders',     icon: 'W', key: 'orders' },
  customers:     { label: 'Customers',       href: '/customers',       icon: 'C', key: 'customers' },
  fleet:         { label: 'Fleet',           href: '/fleet',           icon: 'F', key: 'fleet' },
  drivers:       { label: 'Drivers',         href: '/drivers',         icon: 'd', key: 'drivers' },
  shop_floor:    { label: 'Shop Floor',      href: '/shop-floor',      icon: 'S', key: 'floor' },
  invoices:      { label: 'Invoices',        href: '/invoices',        icon: '$', key: 'invoices' },
  parts:         { label: 'Parts',           href: '/parts',           icon: 'P', key: 'parts' },
  maintenance:   { label: 'Maintenance',     href: '/maintenance',     icon: 'M', key: 'maintenance' },
  compliance:    { label: 'Compliance',      href: '/compliance',      icon: 'c', key: 'compliance' },
  accounting:    { label: 'Accounting',      href: '/accounting',      icon: 'A', key: 'accounting' },
  reports:       { label: 'Reports',         href: '/reports',         icon: 'R', key: 'reports' },
  time_tracking: { label: 'Time Tracking',   href: '/time-tracking',   icon: 't', key: 'time_tracking' },
  smart_drop:    { label: 'Smart Drop',      href: '/smart-drop',      icon: 'U', key: 'smart_drop' },
  settings:      { label: 'Settings',        href: '/settings',        icon: 'G', key: 'settings' },
}

function sidebar(...keys: string[]): SidebarItem[] {
  return keys.map(k => SIDEBAR_ITEMS[k])
}

// ---- All modules (for full-access roles) ----

const ALL_MODULES = [
  'dashboard', 'kiosk_admin', 'orders', 'customers', 'fleet', 'invoices',
  'parts', 'drivers', 'floor', 'maintenance', 'tires', 'parts_lifecycle',
  'compliance', 'accounting', 'reports', 'time_tracking', 'settings',
  'import', 'admin_permissions', 'tech_mobile', 'dvir', 'billing',
  'integrations', 'audit_log', 'smart_drop',
]

function allTrue(): Record<string, boolean> {
  return Object.fromEntries(ALL_MODULES.map(k => [k, true]))
}

function allExcept(excluded: string[]): Record<string, boolean> {
  return Object.fromEntries(ALL_MODULES.map(k => [k, !excluded.includes(k)]))
}

// ---- Full sidebar for owner/gm/it ----

const FULL_SIDEBAR = sidebar(
  'dashboard', 'kiosk', 'work_orders', 'customers', 'fleet', 'drivers',
  'shop_floor', 'invoices', 'parts', 'maintenance', 'compliance',
  'accounting', 'reports', 'time_tracking', 'smart_drop', 'settings',
)

// ---- Role configurations ----

export const ROLE_CONFIGS: Record<RoleKey, RoleConfig> = {
  owner: {
    label: 'Owner',
    redirectTo: '/dashboard',
    sidebar: FULL_SIDEBAR,
    permissions: allTrue(),
  },
  gm: {
    label: 'GM',
    redirectTo: '/dashboard',
    sidebar: FULL_SIDEBAR,
    permissions: allTrue(),
  },
  it_person: {
    label: 'IT Admin',
    redirectTo: '/dashboard',
    sidebar: FULL_SIDEBAR,
    permissions: allTrue(),
  },

  shop_manager: {
    label: 'Shop Manager',
    redirectTo: '/floor-manager/dashboard',
    sidebar: sidebar(
      'work_orders', 'customers', 'shop_floor', 'time_tracking',
    ),
    permissions: {
      dashboard: false, floor: true, orders: true, invoices: false, customers: true,
      parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: false, reports: false,
      time_tracking: true, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },

  service_writer: {
    label: 'Service Writer',
    redirectTo: '/work-orders',
    sidebar: sidebar('shop_floor', 'work_orders', 'customers', 'smart_drop'),
    permissions: {
      dashboard: false, floor: true, orders: true, invoices: false, customers: true,
      parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: false, reports: false,
      time_tracking: false, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: true,
    },
  },

  technician: {
    label: 'Technician',
    redirectTo: '/mechanic/dashboard',
    sidebar: [], // standalone page, no sidebar
    permissions: {
      dashboard: false, floor: false, orders: false, invoices: false, customers: false,
      parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: false, reports: false,
      time_tracking: true, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },

  lead_tech: {
    label: 'Lead Tech',
    redirectTo: '/mechanic/dashboard',
    sidebar: [], // standalone page, no sidebar
    permissions: {
      dashboard: false, floor: false, orders: false, invoices: false, customers: false,
      parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: false, reports: false,
      time_tracking: true, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },

  parts_manager: {
    label: 'Parts Dept',
    redirectTo: '/parts',
    sidebar: sidebar('dashboard', 'shop_floor', 'work_orders', 'parts'),
    permissions: {
      dashboard: true, floor: true, orders: true, invoices: false, customers: false,
      parts: true, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: true, compliance: false, accounting: false, reports: false,
      time_tracking: false, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },

  fleet_manager: {
    label: 'Fleet Manager',
    redirectTo: '/fleet',
    sidebar: sidebar('fleet', 'drivers', 'compliance', 'reports'),
    permissions: {
      dashboard: false, floor: false, orders: false, invoices: false, customers: false,
      parts: false, fleet: true, drivers: true, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: true, accounting: false, reports: true,
      time_tracking: false, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: true,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },

  maintenance_manager: {
    label: 'Maint. Manager',
    redirectTo: '/maintenance',
    sidebar: sidebar(
      'fleet', 'maintenance',
      'compliance', 'reports', 'time_tracking',
    ),
    permissions: {
      dashboard: false, floor: false, orders: false, invoices: false, customers: false,
      parts: false, fleet: true, drivers: false, maintenance: true, tires: true,
      parts_lifecycle: true, compliance: true, accounting: false, reports: true,
      time_tracking: true, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: true,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },

  maintenance_technician: {
    label: 'Maint. Tech',
    redirectTo: '/mechanic/dashboard',
    sidebar: [], // standalone page, no sidebar
    permissions: {
      dashboard: false, floor: false, orders: false, invoices: false, customers: false,
      parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: false, reports: false,
      time_tracking: true, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },

  accountant: {
    label: 'Accounting',
    redirectTo: '/accounting',
    sidebar: sidebar('dashboard', 'invoices', 'accounting', 'reports', 'smart_drop'),
    permissions: {
      dashboard: true, floor: false, orders: false, invoices: true, customers: false,
      parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: true, reports: true,
      time_tracking: false, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: true,
    },
  },

  office_admin: {
    label: 'Office Admin',
    redirectTo: '/dashboard',
    sidebar: sidebar(
      'dashboard', 'shop_floor', 'work_orders', 'invoices', 'customers',
      'parts', 'accounting', 'reports', 'time_tracking', 'smart_drop', 'settings',
    ),
    permissions: {
      dashboard: true, floor: true, orders: true, invoices: true, customers: true,
      parts: true, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: true, reports: true,
      time_tracking: true, settings: true, kiosk_admin: false,
      import: true, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: true,
    },
  },

  dispatcher: {
    label: 'Dispatcher',
    redirectTo: '/fleet',
    sidebar: sidebar('dashboard', 'shop_floor', 'fleet', 'drivers'),
    permissions: {
      dashboard: true, floor: true, orders: false, invoices: false, customers: false,
      parts: false, fleet: true, drivers: true, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: false, reports: false,
      time_tracking: false, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },

  driver: {
    label: 'Driver',
    redirectTo: '/dvir',
    sidebar: [], // no sidebar
    permissions: {
      dashboard: false, floor: false, orders: false, invoices: false, customers: false,
      parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: false, reports: false,
      time_tracking: false, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: true,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },

  customer: {
    label: 'Customer',
    redirectTo: '/portal',
    sidebar: [], // no sidebar
    permissions: {
      dashboard: false, floor: false, orders: false, invoices: false, customers: false,
      parts: false, fleet: false, drivers: false, maintenance: false, tires: false,
      parts_lifecycle: false, compliance: false, accounting: false, reports: false,
      time_tracking: false, settings: false, kiosk_admin: false,
      import: false, admin_permissions: false, tech_mobile: false, dvir: false,
      billing: false, integrations: false, audit_log: false, smart_drop: false,
    },
  },
}

// ---- Legacy-compatible exports ----

export const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  gm: 'GM',
  it_person: 'IT Admin',
  shop_manager: 'Shop Manager',
  service_writer: 'Service Writer',
  technician: 'Technician',
  lead_tech: 'Lead Tech',
  parts_manager: 'Parts Dept',
  fleet_manager: 'Fleet Manager',
  maintenance_manager: 'Maint. Manager',
  maintenance_technician: 'Maint. Tech',
  accountant: 'Accounting',
  office_admin: 'Office Admin',
  dispatcher: 'Dispatcher',
  driver: 'Driver',
  customer: 'Customer',
}

export const ROLE_COLOR: Record<string, string> = {
  owner: '#D94F4F',
  gm: '#D94F4F',
  it_person: '#D94F4F',
  shop_manager: '#D4882A',
  service_writer: '#4D9EFF',
  technician: '#1DB870',
  lead_tech: '#1DB870',
  parts_manager: '#8B5CF6',
  fleet_manager: '#0E9F8E',
  maintenance_manager: '#0E9F8E',
  maintenance_technician: '#1DB870',
  accountant: '#E8692A',
  office_admin: '#D4882A',
  dispatcher: '#0E9F8E',
  driver: '#7C8BA0',
  customer: '#7C8BA0',
}

// All roles in display order
export const ALL_ROLES: RoleKey[] = [
  'owner', 'gm', 'it_person', 'shop_manager', 'service_writer',
  'technician', 'lead_tech', 'parts_manager', 'fleet_manager',
  'maintenance_manager', 'maintenance_technician', 'accountant',
  'office_admin', 'dispatcher', 'driver', 'customer',
]
