import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthenticatedUserProfile, getActorShopId } from '@/lib/server-auth'

// Settings/permissions audience — same as src/app/settings/permissions/page.tsx
// MANAGER_ROLES (the page that owns this UI). Kept inline because no canonical
// constant in src/lib/roles.ts matches this exact set; src/lib/roles.ts is out
// of scope for this patch.
const PERMISSIONS_SETTINGS_ROLES = [
  'owner', 'gm', 'it_person', 'shop_manager',
  'parts_manager', 'maintenance_manager', 'office_admin',
]

export async function GET(req: Request, { params }: { params: Promise<{ shopId: string; employeeId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const user = await getAuthenticatedUserProfile()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.is_platform_owner && !PERMISSIONS_SETTINGS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { shopId, employeeId } = await params

  if (!user.is_platform_owner && getActorShopId(user) !== shopId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Verify employee belongs to the authorized shop. 404 (not 403) so we don't
  // leak whether an employeeId exists in some other shop.
  const { data: emp } = await supabase.from('users').select('id').eq('id', employeeId).eq('shop_id', shopId).single()
  if (!emp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
  const user = await getAuthenticatedUserProfile()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.is_platform_owner && !PERMISSIONS_SETTINGS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { shopId, employeeId } = await params

  if (!user.is_platform_owner && getActorShopId(user) !== shopId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Verify employee belongs to the authorized shop before upsert. Prevents
  // creating an employee_permissions row keyed to a foreign or fake employee_id.
  const { data: emp } = await supabase.from('users').select('id').eq('id', employeeId).eq('shop_id', shopId).single()
  if (!emp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
