// ============================================================
// TRUCKZEN — UNIFIED PERMISSIONS
// Single function: getPermissions(user) → all boolean flags
// No frontend trust. Everything derived from user object only.
// ============================================================

const PLATFORM_OWNER_EMAIL = 'kenanagasiyev@gmail.com'

export interface TruckZenPermissions {
  // Financial visibility
  canViewFinancials: boolean
  canViewCostPrice: boolean
  canViewSellPrice: boolean

  // Parts
  canManageParts: boolean

  // User management
  canManageUsers: boolean

  // Jobs
  canAssignJobs: boolean
  canViewAllJobs: boolean
  canViewOwnJobsOnly: boolean

  // Platform
  canAccessPlatformAdmin: boolean
  canImpersonate: boolean

  // Derived flags (useful across the app)
  isPlatformOwner: boolean
  role: string
}

// Roles → permission map
const ROLE_PERMISSIONS: Record<string, Omit<TruckZenPermissions, 'isPlatformOwner' | 'role'>> = {
  owner: {
    canViewFinancials: true,
    canViewCostPrice: true,
    canViewSellPrice: true,
    canManageParts: true,
    canManageUsers: true,
    canAssignJobs: true,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: true,
  },
  gm: {
    canViewFinancials: true,
    canViewCostPrice: true,
    canViewSellPrice: true,
    canManageParts: true,
    canManageUsers: true,
    canAssignJobs: true,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  it_person: {
    canViewFinancials: true,
    canViewCostPrice: true,
    canViewSellPrice: true,
    canManageParts: true,
    canManageUsers: true,
    canAssignJobs: true,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: true,
    canImpersonate: true,
  },
  shop_manager: {
    canViewFinancials: true,
    canViewCostPrice: false,
    canViewSellPrice: true,
    canManageParts: false,
    canManageUsers: true,
    canAssignJobs: true,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  accounting: {
    canViewFinancials: true,
    canViewCostPrice: true,
    canViewSellPrice: true,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: false,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  accountant: {
    canViewFinancials: true,
    canViewCostPrice: true,
    canViewSellPrice: true,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: false,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  accounting_manager: {
    canViewFinancials: true,
    canViewCostPrice: true,
    canViewSellPrice: true,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  office_admin: {
    canViewFinancials: true,
    canViewCostPrice: true,
    canViewSellPrice: true,
    canManageParts: true,
    canManageUsers: true,
    canAssignJobs: true,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  floor_manager: {
    canViewFinancials: true,
    canViewCostPrice: false,
    canViewSellPrice: true,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: true,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  service_manager: {
    canViewFinancials: true,
    canViewCostPrice: false,
    canViewSellPrice: true,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: true,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  service_writer: {
    canViewFinancials: false,
    canViewCostPrice: false,
    canViewSellPrice: true,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  parts: {
    canViewFinancials: false,
    canViewCostPrice: true,
    canViewSellPrice: true,
    canManageParts: true,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: false,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  parts_manager: {
    canViewFinancials: false,
    canViewCostPrice: true,
    canViewSellPrice: true,
    canManageParts: true,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  mechanic: {
    canViewFinancials: false,
    canViewCostPrice: false,
    canViewSellPrice: false,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: false,
    canViewOwnJobsOnly: true,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  technician: {
    canViewFinancials: false,
    canViewCostPrice: false,
    canViewSellPrice: false,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: false,
    canViewOwnJobsOnly: true,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  lead_tech: {
    canViewFinancials: false,
    canViewCostPrice: false,
    canViewSellPrice: false,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  maintenance_manager: {
    canViewFinancials: false,
    canViewCostPrice: false,
    canViewSellPrice: true,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: true,
    canViewAllJobs: true,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  maintenance_technician: {
    canViewFinancials: false,
    canViewCostPrice: false,
    canViewSellPrice: false,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: false,
    canViewOwnJobsOnly: true,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  fleet_manager: {
    canViewFinancials: false,
    canViewCostPrice: false,
    canViewSellPrice: true,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: false,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  dispatcher: {
    canViewFinancials: false,
    canViewCostPrice: false,
    canViewSellPrice: false,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: false,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
  driver: {
    canViewFinancials: false,
    canViewCostPrice: false,
    canViewSellPrice: false,
    canManageParts: false,
    canManageUsers: false,
    canAssignJobs: false,
    canViewAllJobs: false,
    canViewOwnJobsOnly: false,
    canAccessPlatformAdmin: false,
    canImpersonate: false,
  },
}

// All-false fallback for unknown roles
const NO_PERMISSIONS: Omit<TruckZenPermissions, 'isPlatformOwner' | 'role'> = {
  canViewFinancials: false,
  canViewCostPrice: false,
  canViewSellPrice: false,
  canManageParts: false,
  canManageUsers: false,
  canAssignJobs: false,
  canViewAllJobs: false,
  canViewOwnJobsOnly: false,
  canAccessPlatformAdmin: false,
  canImpersonate: false,
}

// All-true for platform owner
const FULL_ACCESS: Omit<TruckZenPermissions, 'isPlatformOwner' | 'role'> = {
  canViewFinancials: true,
  canViewCostPrice: true,
  canViewSellPrice: true,
  canManageParts: true,
  canManageUsers: true,
  canAssignJobs: true,
  canViewAllJobs: true,
  canViewOwnJobsOnly: false,
  canAccessPlatformAdmin: true,
  canImpersonate: true,
}

/**
 * Get all permissions for a user.
 * No frontend trust — derived entirely from the user object.
 *
 * @param user - Must have at minimum: { email, role, is_platform_owner? }
 * @returns TruckZenPermissions with all boolean flags
 */
export function getPermissions(user: { email?: string | null; role?: string | null; is_platform_owner?: boolean }): TruckZenPermissions {
  if (!user) {
    return { ...NO_PERMISSIONS, isPlatformOwner: false, role: 'unknown' }
  }

  const role = user.role || 'unknown'

  // Platform owner check: flag on user record OR email match
  const isPlatformOwner = user.is_platform_owner === true || user.email === PLATFORM_OWNER_EMAIL

  if (isPlatformOwner) {
    return { ...FULL_ACCESS, isPlatformOwner: true, role }
  }

  const perms = ROLE_PERMISSIONS[role] || NO_PERMISSIONS

  return { ...perms, isPlatformOwner: false, role }
}
