import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { getPermissions } from '@/lib/getPermissions'

const ALLOWED_IMPERSONATION_ROLES = new Set(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'maintenance_manager'])

// POST /api/impersonate — set or clear impersonation role for the authenticated user
export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)
  const requestedRole = typeof body?.role === 'string' ? body.role : null

  const perms = getPermissions(actor)
  if (!perms.canImpersonate) {
    return jsonError('Not authorized to impersonate', 403)
  }

  const effectiveRole = requestedRole && requestedRole !== 'reset' ? requestedRole : null
  if (effectiveRole && !ALLOWED_IMPERSONATION_ROLES.has(effectiveRole)) {
    return jsonError('Invalid impersonation role', 400)
  }

  const newRole = effectiveRole === actor.role ? null : effectiveRole

  const { error } = await s
    .from('users')
    .update({ impersonate_role: newRole })
    .eq('id', actor.id)

  if (error) return jsonError(error.message, 500)

  return NextResponse.json({ ok: true, impersonate_role: newRole, actual_role: actor.role })
}
