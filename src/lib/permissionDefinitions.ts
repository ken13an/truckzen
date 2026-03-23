// ============================================================
// TRUCKZEN — DEPARTMENT PERMISSION DEFINITIONS
// Controls what managers can toggle for their employees
// ============================================================

export type PermissionKey = string

export interface PermissionItem {
  key: PermissionKey
  label: string
  description: string
  defaultValue: boolean
}

export interface DepartmentPermissions {
  department: string
  label: string
  managerRoles: string[]
  employeeRoles: string[]
  permissions: PermissionItem[]
}

export const DEPARTMENT_PERMISSIONS: DepartmentPermissions[] = [
  {
    department: 'parts',
    label: 'Parts Department',
    managerRoles: ['parts_manager'],
    employeeRoles: ['parts_manager'],
    permissions: [
      { key: 'parts.view_inventory', label: 'View Parts Inventory', description: 'Can see parts list and stock levels', defaultValue: true },
      { key: 'parts.view_selling_price', label: 'View Selling Price', description: 'Can see the customer-facing price', defaultValue: true },
      { key: 'parts.view_cost_price', label: 'View Cost Price', description: 'Can see what parts cost us', defaultValue: false },
      { key: 'parts.view_vendor_info', label: 'View Vendor Information', description: 'Can see supplier names and contacts', defaultValue: false },
      { key: 'parts.edit_inventory', label: 'Edit Inventory', description: 'Can add, edit, or remove parts', defaultValue: false },
      { key: 'parts.create_po', label: 'Create Purchase Orders', description: 'Can create POs for restocking', defaultValue: false },
      { key: 'parts.approve_requests', label: 'Approve Parts Requests', description: 'Can approve mechanic parts requests', defaultValue: false },
    ],
  },
  {
    department: 'floor',
    label: 'Shop Floor',
    managerRoles: ['shop_manager'],
    employeeRoles: ['technician', 'lead_tech', 'maintenance_technician'],
    permissions: [
      { key: 'floor.view_all_jobs', label: 'View All Jobs', description: 'Can see jobs assigned to other mechanics', defaultValue: false },
      { key: 'floor.view_labor_rates', label: 'View Labor Rates', description: 'Can see hourly labor rates on WOs', defaultValue: false },
      { key: 'floor.view_wo_totals', label: 'View WO Totals', description: 'Can see total dollar amount on work orders', defaultValue: false },
      { key: 'floor.edit_job_notes', label: 'Edit Job Notes', description: 'Can edit notes on assigned jobs', defaultValue: true },
      { key: 'floor.request_parts', label: 'Request Parts', description: 'Can submit parts requests', defaultValue: true },
      { key: 'floor.clock_in_out', label: 'Clock In/Out', description: 'Can log time on jobs', defaultValue: true },
    ],
  },
  {
    department: 'accounting',
    label: 'Accounting',
    managerRoles: ['office_admin'],
    employeeRoles: ['accountant'],
    permissions: [
      { key: 'accounting.view_invoices', label: 'View Invoices', description: 'Can see all customer invoices', defaultValue: true },
      { key: 'accounting.edit_invoices', label: 'Edit Invoices', description: 'Can modify invoice line items', defaultValue: false },
      { key: 'accounting.view_payments', label: 'View Payments', description: 'Can see payment records', defaultValue: true },
      { key: 'accounting.process_payments', label: 'Process Payments', description: 'Can mark invoices as paid', defaultValue: false },
      { key: 'accounting.view_cost_data', label: 'View Cost Data', description: 'Can see parts cost and labor costs', defaultValue: true },
      { key: 'accounting.view_reports', label: 'View Reports', description: 'Can access accounting reports', defaultValue: true },
      { key: 'accounting.export_data', label: 'Export Data', description: 'Can export reports and data', defaultValue: false },
    ],
  },
  {
    department: 'service',
    label: 'Service Writers',
    managerRoles: ['shop_manager'],
    employeeRoles: ['service_writer', 'service_advisor'],
    permissions: [
      { key: 'service.create_wo', label: 'Create Work Orders', description: 'Can open new work orders', defaultValue: true },
      { key: 'service.edit_wo', label: 'Edit Work Orders', description: 'Can modify existing WOs', defaultValue: true },
      { key: 'service.view_all_customers', label: 'View All Customers', description: 'Can see full customer list', defaultValue: true },
      { key: 'service.edit_customer_info', label: 'Edit Customer Info', description: 'Can update customer profiles', defaultValue: false },
      { key: 'service.apply_discounts', label: 'Apply Discounts', description: 'Can add discounts to invoices', defaultValue: false },
      { key: 'service.override_prices', label: 'Override Prices', description: 'Can manually change line item prices', defaultValue: false },
      { key: 'service.view_profit_margin', label: 'View Profit Margin', description: 'Can see profit margin on WOs', defaultValue: false },
    ],
  },
]
