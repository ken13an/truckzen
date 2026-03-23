import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export async function GET(req: Request, { params }: { params: Promise<{ shopId: string; employeeId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopId, employeeId } = await params

  const { data, error } = await supabase
    .from('employee_permissions')
    .select('*')
    .eq('shop_id', shopId)
    .eq('employee_id', employeeId)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ permissions: data?.permissions ?? {} })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ shopId: string; employeeId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only managers and admins can update permissions
  const allowed = ['owner', 'gm', 'it_person', 'shop_manager', 'parts_manager', 'maintenance_manager']
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { shopId, employeeId } = await params
  const body = await req.json()
  const { permissions, department } = body

  const { error } = await supabase
    .from('employee_permissions')
    .upsert({
      shop_id: shopId,
      employee_id: employeeId,
      manager_id: user.id,
      department,
      permissions,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id,employee_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
