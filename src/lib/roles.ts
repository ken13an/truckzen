/**
 * TruckZen — Shared Role Constants
 * Single source of truth for role groups used across API routes.
 * Do NOT duplicate these arrays inline — import from here.
 */

// Platform admin — full system access
export const ADMIN_ROLES: string[] = ['owner', 'gm', 'it_person']

// Management — user/shop management
export const MANAGEMENT_ROLES: string[] = ['owner', 'gm', 'it_person', 'shop_manager', 'office_admin']

// Accounting — financial operations
export const ACCOUNTING_ROLES: string[] = ['owner', 'gm', 'it_person', 'accountant', 'accounting_manager', 'office_admin']

// Service write — create/edit WOs, service operations
export const SERVICE_WRITE_ROLES: string[] = ['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin']

// Assignment — assign mechanics to jobs
export const ASSIGNMENT_ROLES: string[] = ['owner', 'gm', 'it_person', 'shop_manager', 'floor_manager', 'service_writer', 'office_admin']

// Parts management — fulfill parts requests, manage parts workflow
export const PARTS_MANAGE_ROLES: string[] = ['owner', 'gm', 'it_person', 'shop_manager', 'parts_manager', 'parts_clerk', 'floor_manager', 'office_admin']

// Invoice actions — roles that can perform invoice workflow actions (submit, approve, mark paid, close, reopen)
export const INVOICE_ACTION_ROLES: string[] = ['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'accountant', 'accounting_manager']

// WO full access — all operational roles that can mutate WO data
export const WO_FULL_ACCESS_ROLES: string[] = ['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager', 'accountant', 'accounting_manager']

// Service + parts operational (no accounting) — for line creation, parts workflow
export const SERVICE_PARTS_ROLES: string[] = ['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager']
