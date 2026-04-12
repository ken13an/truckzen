import { ACCOUNTING_ROLES } from '@/lib/roles'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { parsePageParams } from '@/lib/query-limits'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }



export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ACCOUNTING_ROLES.includes(user.impersonate_role || user.role) && !(user.is_platform_owner && !user.impersonate_role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const shopId = user.shop_id
  const { searchParams } = new URL(req.url)
  const { page, limit, offset } = parsePageParams(searchParams)
  const status = searchParams.get('invoice_status')

  const s = db()
  let q = s
    .from('service_orders')
    .select('id, so_number, status, invoice_status, complaint, grand_total, created_at, updated_at, accounting_notes, accounting_approved_at, accounting_approved_by, customers(id, company_name, contact_name), assets(id, unit_number, year, make, model)', { count: 'exact' })
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .neq('status', 'void')
    .not('so_number', 'like', 'DRAFT-%')
    .neq('is_historical', true)
    .neq('source', 'fullbay')
    .order('updated_at', { ascending: false })

  if (status && status !== 'all') {
    q = q.eq('invoice_status', status)
  } else {
    q = q.in('invoice_status', ['accounting_review', 'pending_accounting', 'sent', 'paid', 'closed', 'quality_check_failed', 'draft'])
  }

  const { data, count, error } = await q.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [], total: count || 0, page, limit, total_pages: Math.ceil((count || 0) / limit) })
}
