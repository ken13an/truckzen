import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthenticatedUserProfile, getActorShopId } from '@/lib/server-auth'
import { DEPARTMENT_PERMISSIONS } from '@/lib/permissionDefinitions'

// Settings/permissions audience — same as src/app/settings/permissions/page.tsx
// MANAGER_ROLES (the page that owns this UI). Kept inline because no canonical
// constant in src/lib/roles.ts matches this exact set; src/lib/roles.ts is out
// of scope for this patch.
const PERMISSIONS_SETTINGS_ROLES = [
  'owner', 'gm', 'it_person', 'shop_manager',
  'parts_manager', 'maintenance_manager', 'office_admin',
]

export async function GET(req: Request, { params }: { params: Promise<{ shopId: string; department: string }> }) {
  const supabase = await createServerSupabaseClient()
  const user = await getAuthenticatedUserProfile()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.is_platform_owner && !PERMISSIONS_SETTINGS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { shopId, department } = await params

  if (!user.is_platform_owner && getActorShopId(user) !== shopId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Find the department definition to get employee roles
  const deptDef = DEPARTMENT_PERMISSIONS.find(d => d.department === department)
  if (!deptDef) return NextResponse.json({ error: 'Unknown department' }, { status: 400 })

  // Get employees whose role matches this department
  const { data: employees, error: empError } = await supabase
    .from('users')
    .select('id, full_name, email, role, team')
    .eq('shop_id', shopId)
    .in('role', deptDef.employeeRoles)
    .eq('active', true)

  if (empError) return NextResponse.json({ error: empError.message }, { status: 500 })

  // Get permissions for all employees in this department
  const employeeIds = (employees ?? []).map(e => e.id)
  let perms: any[] = []
  if (employeeIds.length > 0) {
    const { data } = await supabase
      .from('employee_permissions')
      .select('*')
      .eq('shop_id', shopId)
      .in('employee_id', employeeIds)
    perms = data ?? []
  }

  // Merge
  const result = (employees ?? []).map(emp => ({
    ...emp,
    permissions: perms.find(p => p.employee_id === emp.id)?.permissions ?? {},
  }))

  return NextResponse.json({ employees: result })
}
