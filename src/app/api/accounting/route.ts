import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

const ALLOWED_ROLES = ['owner', 'gm', 'it_person', 'accountant', 'office_admin', 'accounting_manager']

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const shopId = user.shop_id

  const s = db()
  const { data, error } = await s
    .from('service_orders')
    .select('id, so_number, status, invoice_status, complaint, grand_total, created_at, updated_at, accounting_notes, accounting_approved_at, accounting_approved_by, customers(id, company_name, contact_name), assets(id, unit_number, year, make, model)')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .neq('status', 'void')
    .not('so_number', 'like', 'DRAFT-%')
    .or('is_historical.is.null,is_historical.eq.false')
    .neq('source', 'fullbay')
    .in('invoice_status', ['accounting_review', 'sent', 'paid', 'closed', 'quality_check_failed', 'draft'])
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
