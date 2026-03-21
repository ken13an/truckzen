import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/admin/shops/[id]/clear-test-data — wipe all data for a shop
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = db()
  const { id: shopId } = await params
  const body = await req.json()
  const { user_id, confirm } = body

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!confirm) return NextResponse.json({ error: 'confirm: true required' }, { status: 400 })

  // Verify platform owner
  const { data: caller } = await s.from('users')
    .select('id, is_platform_owner')
    .eq('id', user_id)
    .single()

  if (!caller?.is_platform_owner) {
    return NextResponse.json({ error: 'Access denied — platform owners only' }, { status: 403 })
  }

  // Verify shop exists
  const { data: shop } = await s.from('shops').select('id, name').eq('id', shopId).single()
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const counts: Record<string, number> = {}

  // Get all service order IDs for this shop
  const { data: sos } = await s.from('service_orders').select('id').eq('shop_id', shopId)
  const soIds = (sos || []).map((so: any) => so.id)

  // Get all SO line IDs
  let soLineIds: string[] = []
  if (soIds.length > 0) {
    const { data: lines } = await s.from('so_lines').select('id').in('service_order_id', soIds)
    soLineIds = (lines || []).map((l: any) => l.id)
  }

  // Get all invoice IDs for this shop
  const { data: invs } = await s.from('invoices').select('id').eq('shop_id', shopId)
  const invoiceIds = (invs || []).map((i: any) => i.id)

  // Get all customer IDs for this shop
  const { data: custs } = await s.from('customers').select('id').eq('shop_id', shopId)
  const customerIds = (custs || []).map((c: any) => c.id)

  // Delete in dependency order (most-dependent first)

  // 1. job_assignments (via so_lines)
  if (soLineIds.length > 0) {
    const { count } = await s.from('job_assignments').delete({ count: 'exact' }).in('so_line_id', soLineIds)
    counts.job_assignments = count || 0
  }

  // 2. wo_job_assignments
  if (soIds.length > 0) {
    const { count } = await s.from('wo_job_assignments').delete({ count: 'exact' }).in('service_order_id', soIds)
    counts.wo_job_assignments = count || 0
  }

  // 3. parts_requests
  if (soIds.length > 0) {
    const { count } = await s.from('parts_requests').delete({ count: 'exact' }).in('service_order_id', soIds)
    counts.parts_requests = count || 0
  }

  // 4. so_time_entries
  if (soIds.length > 0) {
    const { count } = await s.from('so_time_entries').delete({ count: 'exact' }).in('service_order_id', soIds)
    counts.so_time_entries = count || 0
  }

  // 5. wo_notes
  if (soIds.length > 0) {
    const { count } = await s.from('wo_notes').delete({ count: 'exact' }).in('service_order_id', soIds)
    counts.wo_notes = count || 0
  }

  // 6. wo_files
  if (soIds.length > 0) {
    const { count } = await s.from('wo_files').delete({ count: 'exact' }).in('service_order_id', soIds)
    counts.wo_files = count || 0
  }

  // 7. invoice_lines (via invoices)
  if (invoiceIds.length > 0) {
    const { count } = await s.from('invoice_lines').delete({ count: 'exact' }).in('invoice_id', invoiceIds)
    counts.invoice_lines = count || 0
  }

  // 8. invoices
  if (invoiceIds.length > 0) {
    const { count } = await s.from('invoices').delete({ count: 'exact' }).in('id', invoiceIds)
    counts.invoices = count || 0
  }

  // 9. so_lines
  if (soIds.length > 0) {
    const { count } = await s.from('so_lines').delete({ count: 'exact' }).in('service_order_id', soIds)
    counts.so_lines = count || 0
  }

  // 10. service_orders
  {
    const { count } = await s.from('service_orders').delete({ count: 'exact' }).eq('shop_id', shopId)
    counts.service_orders = count || 0
  }

  // 11. customer_contacts
  if (customerIds.length > 0) {
    const { count } = await s.from('customer_contacts').delete({ count: 'exact' }).in('customer_id', customerIds)
    counts.customer_contacts = count || 0
  }

  // 12. assets
  {
    const { count } = await s.from('assets').delete({ count: 'exact' }).eq('shop_id', shopId)
    counts.assets = count || 0
  }

  // 13. customers
  {
    const { count } = await s.from('customers').delete({ count: 'exact' }).eq('shop_id', shopId)
    counts.customers = count || 0
  }

  // 14. test users (non-platform-owner technicians/mechanics)
  {
    const { data: testUsers } = await s.from('users')
      .select('id')
      .eq('shop_id', shopId)
      .in('role', ['technician', 'mechanic', 'lead_tech', 'maintenance_technician'])
      .or('is_platform_owner.is.null,is_platform_owner.eq.false')

    const testUserIds = (testUsers || []).map((u: any) => u.id)
    if (testUserIds.length > 0) {
      const { count } = await s.from('users').delete({ count: 'exact' }).in('id', testUserIds)
      counts.test_users = count || 0

      // Also delete auth users
      for (const uid of testUserIds) {
        await s.auth.admin.deleteUser(uid).catch(() => {})
      }
    }
  }

  return NextResponse.json({
    shop: shop.name,
    cleared: counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  })
}
