import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'

// /api/migrate/log — read/write rows in migration_logs. Platform-owner only:
// this is operational tooling paired with /api/migrate/import (also
// platform-owner gated). Body/query shop_id and body user_id are no longer
// trusted — the actor identity comes from the server session.

// ── GET: list migration logs for shop ───────────────────────
export async function GET(req: Request) {
  const { error: authError } = await requirePlatformOwner()
  if (authError) return authError

  const supabase = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')

  if (!shopId) {
    return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  }

  const page = parseInt(searchParams.get('page') || '1')
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50'), 200)
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data, error, count } = await supabase
    .from('migration_logs')
    .select('*', { count: 'exact' })
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    total: count || 0,
    page,
    per_page: perPage,
  })
}

// ── POST: create new migration log entry ────────────────────
export async function POST(req: Request) {
  const { actor, error: authError } = await requirePlatformOwner()
  if (authError || !actor) return authError!

  const supabase = createAdminSupabaseClient()

  try {
    const body = await req.json()
    const { shop_id, source, data_type, status, notes } = body

    if (!shop_id || !source || !data_type) {
      return NextResponse.json({ error: 'shop_id, source, and data_type are required' }, { status: 400 })
    }

    const { data, error } = await supabase.from('migration_logs').insert({
      shop_id,
      user_id: actor.id,
      source,
      data_type,
      status: status || 'started',
      imported: 0,
      updated: 0,
      skipped: 0,
      error_count: 0,
      errors: null,
      notes: notes || null,
    }).select().single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create log' }, { status: 500 })
  }
}

// ── PATCH: update migration log (status, stats, errors) ─────
export async function PATCH(req: Request) {
  const { error: authError } = await requirePlatformOwner()
  if (authError) return authError

  const supabase = createAdminSupabaseClient()

  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Only allow safe fields to be updated
    const allowed: Record<string, any> = {}
    const safeFields = ['status', 'imported', 'updated', 'skipped', 'error_count', 'errors', 'notes', 'completed_at']
    for (const key of safeFields) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }

    // Auto-set completed_at when status is terminal
    if (allowed.status && ['completed', 'completed_with_errors', 'failed'].includes(allowed.status)) {
      allowed.completed_at = new Date().toISOString()
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('migration_logs')
      .update(allowed)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update log' }, { status: 500 })
  }
}
