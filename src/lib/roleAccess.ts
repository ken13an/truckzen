// src/lib/roleAccess.ts — Extended role capabilities beyond module access
// Module access is handled by permissions.ts (DEFAULT_ROLE_PERMISSIONS)
// This file handles data-level visibility rules

export type PayrollAccess = 'all' | 'own_team' | 'none'

export interface RoleCapabilities {
  canSeeCustomerData: boolean
  canSeePayroll: PayrollAccess
  canSeePartsCostPrice: boolean
  canSeeWOFinancials: boolean
  canSeeFullAccounting: boolean
  canSeeMaintenance: boolean
  canSeePlatformAdmin: boolean
}

export const ROLE_ACCESS: Record<string, RoleCapabilities> = {
  owner: {
    canSeeCustomerData: true,
    canSeePayroll: 'all',
    canSeePartsCostPrice: true,
    canSeeWOFinancials: true,
    canSeeFullAccounting: true,
    canSeeMaintenance: true,
    canSeePlatformAdmin: true,
  },
  gm: {
    canSeeCustomerData: true,
    canSeePayroll: 'all',
    canSeePartsCostPrice: true,
    canSeeWOFinancials: true,
    canSeeFullAccounting: true,
    canSeeMaintenance: true,
    canSeePlatformAdmin: false,
  },
  it_person: {
    canSeeCustomerData: true,
    canSeePayroll: 'all',
    canSeePartsCostPrice: true,
    canSeeWOFinancials: true,
    canSeeFullAccounting: true,
    canSeeMaintenance: true,
    canSeePlatformAdmin: true,
  },
  accountant: {
    canSeeCustomerData: true,
    canSeePayroll: 'all',
    canSeePartsCostPrice: true,
    canSeeWOFinancials: true,
    canSeeFullAccounting: true,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  office_admin: {
    canSeeCustomerData: true,
    canSeePayroll: 'all',
    canSeePartsCostPrice: true,
    canSeeWOFinancials: true,
    canSeeFullAccounting: true,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  shop_manager: {
    canSeeCustomerData: true,
    canSeePayroll: 'own_team',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: true,
    canSeeFullAccounting: false,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  floor_manager: {
    canSeeCustomerData: true,
    canSeePayroll: 'own_team',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: true,
    canSeeFullAccounting: false,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  service_writer: {
    canSeeCustomerData: true,
    canSeePayroll: 'none',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: true,
    canSeeFullAccounting: false,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  parts_manager: {
    canSeeCustomerData: true,
    canSeePayroll: 'own_team',
    canSeePartsCostPrice: true,
    canSeeWOFinancials: true,
    canSeeFullAccounting: false,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  parts_staff: {
    canSeeCustomerData: true,
    canSeePayroll: 'none',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: false,
    canSeeFullAccounting: false,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  technician: {
    canSeeCustomerData: false,
    canSeePayroll: 'none',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: false,
    canSeeFullAccounting: false,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  lead_tech: {
    canSeeCustomerData: false,
    canSeePayroll: 'none',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: false,
    canSeeFullAccounting: false,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  maintenance_manager: {
    canSeeCustomerData: false,
    canSeePayroll: 'own_team',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: false,
    canSeeFullAccounting: false,
    canSeeMaintenance: true,
    canSeePlatformAdmin: false,
  },
  maintenance_technician: {
    canSeeCustomerData: false,
    canSeePayroll: 'none',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: false,
    canSeeFullAccounting: false,
    canSeeMaintenance: true,
    canSeePlatformAdmin: false,
  },
  dispatcher: {
    canSeeCustomerData: true,
    canSeePayroll: 'none',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: false,
    canSeeFullAccounting: false,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
  driver: {
    canSeeCustomerData: false,
    canSeePayroll: 'none',
    canSeePartsCostPrice: false,
    canSeeWOFinancials: false,
    canSeeFullAccounting: false,
    canSeeMaintenance: false,
    canSeePlatformAdmin: false,
  },
}

const DEFAULT_CAPABILITIES: RoleCapabilities = {
  canSeeCustomerData: false,
  canSeePayroll: 'none',
  canSeePartsCostPrice: false,
  canSeeWOFinancials: false,
  canSeeFullAccounting: false,
  canSeeMaintenance: false,
  canSeePlatformAdmin: false,
}

export function getRoleCapabilities(role: string): RoleCapabilities {
  return ROLE_ACCESS[role] || DEFAULT_CAPABILITIES
}
