import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { MANAGEMENT_ROLES } from '@/lib/roles'

type P = { params: Promise<{ id: string }> }

const MANAGE_USER_ROLES = MANAGEMENT_ROLES
const OWNER_ONLY_ROLE_CHANGES = new Set(['owner', 'gm', 'it_person'])
const UPDATEABLE_FIELDS = ['role', 'team', 'language', 'telegram_id', 'active', 'full_name', 'phone', 'department'] as const

function canManageUsers(role: string) {
  return MANAGE_USER_ROLES.includes(role)
}

export async function PATCH(req: Request, { params }: P) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!canManageUsers(actor.role)) return jsonError('Forbidden', 403)

  const { id } = await params
  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)

  const { data: target, error: targetError } = await s
    .from('users')
    .select('id, shop_id, role, deleted_at')
    .eq('id', id)
    .single()

  if (targetError || !target || target.deleted_at) return jsonError('User not found', 404)
  if (target.shop_id !== actor.shop_id) return jsonError('Cross-shop edits are not allowed', 403)

  const update: Record<string, unknown> = {}
  for (const field of UPDATEABLE_FIELDS) {
    if (body && Object.prototype.hasOwnProperty.call(body, field)) update[field] = body[field]
  }

  if (Object.keys(update).length === 0) return jsonError('No fields', 400)

  if (typeof update.role === 'string') {
    if (OWNER_ONLY_ROLE_CHANGES.has(update.role) && actor.role !== 'owner') {
      return jsonError('Only owners can assign management roles', 403)
    }
    if (id === actor.id && update.role !== actor.role) {
      return jsonError('You cannot change your own role', 403)
    }
  }

  if (typeof update.active === 'boolean' && id === actor.id && update.active === false) {
    return jsonError('You cannot deactivate your own account', 403)
  }

  if (update.role) {
    const ROLE_DEPT: Record<string, string> = {
      service_writer: 'service', service_manager: 'service', service_advisor: 'service',
      parts_staff: 'parts', parts_manager: 'parts',
      mechanic: 'floor', technician: 'floor', lead_tech: 'floor', floor_supervisor: 'floor', floor_manager: 'floor', shop_manager: 'floor',
      accountant: 'accounting', accounting_manager: 'accounting', office_admin: 'accounting',
      maintenance_tech: 'maintenance', maintenance_technician: 'maintenance', maintenance_manager: 'maintenance',
      fleet_manager: 'fleet', dispatcher: 'fleet',
      driver: 'drivers',
      owner: 'management', gm: 'management', admin: 'management', it_person: 'management',
    }
    update.department = ROLE_DEPT[String(update.role)] || 'management'
  }

  const { data, error } = await s.from('users').update(update).eq('id', id).select().single()
  if (error) return jsonError(error.message, 500)

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!canManageUsers(actor.role)) return jsonError('Forbidden', 403)

  const { id } = await params
  if (id === actor.id) return jsonError('You cannot delete your own account', 403)

  const s = createAdminSupabaseClient()
  const { data: target, error: targetError } = await s
    .from('users')
    .select('id, shop_id, role, deleted_at')
    .eq('id', id)
    .single()

  if (targetError || !target || target.deleted_at) return jsonError('User not found', 404)
  if (target.shop_id !== actor.shop_id) return jsonError('Cross-shop edits are not allowed', 403)
  if (OWNER_ONLY_ROLE_CHANGES.has(target.role) && actor.role !== 'owner') {
    return jsonError('Only owners can remove management users', 403)
  }

  await s.from('users').update({ active: false, deleted_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ success: true })
}
