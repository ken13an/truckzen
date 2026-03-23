import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { DEPARTMENT_PERMISSIONS } from '@/lib/permissionDefinitions'

export async function GET(req: Request, { params }: { params: Promise<{ shopId: string; department: string }> }) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopId, department } = await params

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
