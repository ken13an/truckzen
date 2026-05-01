import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { getPermissions } from '@/lib/getPermissions'
import JSZip from 'jszip'
import { logAction } from '@/lib/services/auditLog'

const TABLE_MAP: Record<string, { table: string; fileName: string; select: string }> = {
  service_orders: { table: 'service_orders', fileName: 'work_orders', select: 'id, so_number, status, priority, complaint, cause, correction, source, is_historical, grand_total, labor_total, parts_total, tax_total, created_at, updated_at, completed_at, customer_id, asset_id, fullbay_id' },
  so_lines: { table: 'so_lines', fileName: 'job_lines', select: 'id, so_id, line_type, description, finding, resolution, quantity, unit_price, total_price, estimated_hours, actual_hours, line_status, part_number, created_at' },
  customers: { table: 'customers', fileName: 'customers', select: 'id, company_name, contact_name, phone, email, address, city, state, zip, dot_number, mc_number, customer_type, is_owner_operator, source, created_at' },
  assets: { table: 'assets', fileName: 'trucks_units', select: 'id, unit_number, vin, year, make, model, unit_type, status, odometer, license_plate, customer_id, source, created_at' },
  // `reserved` is intentionally preserved here for external CSV consumer back-compat.
  // Internal readers were deprecated; column is uniformly 0 across all prod rows.
  parts: { table: 'parts', fileName: 'parts_inventory', select: 'id, part_number, description, category, on_hand, reserved, reorder_point, cost_price, sell_price, vendor, bin_location, source, created_at' },
  invoices: { table: 'invoices', fileName: 'invoices', select: 'id, invoice_number, service_order_id, customer_id, status, subtotal, tax_amount, total, amount_paid, balance_due, payment_method, payment_terms, due_date, sent_at, paid_at, source, created_at' },
  users: { table: 'users', fileName: 'team_members', select: 'id, email, full_name, role, team, language, active, created_at' },
  so_time_entries: { table: 'so_time_entries', fileName: 'time_clock', select: 'id, user_id, so_line_id, service_order_id, clocked_in_at, clocked_out_at, duration_minutes, notes, created_at' },
  parts_requests: { table: 'parts_requests', fileName: 'parts_requests', select: 'id, so_id, so_line_id, requested_by, part_name, description, quantity, status, notes, created_at' },
  kiosk_checkins: { table: 'kiosk_checkins', fileName: 'service_requests', select: 'id, company_name, contact_name, concern_text, priority, status, customer_type, created_at' },
  ai_usage_log: { table: 'ai_usage_log', fileName: 'ai_usage', select: 'id, feature, model, input_tokens, output_tokens, estimated_cost, created_at' },
}

function toCSV(data: any[], columns: string[]): string {
  const BOM = '\uFEFF'
  const header = columns.join(',')
  const rows = data.map(row =>
    columns.map(col => {
      const val = row[col]
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n'))
        return `"${str.replace(/"/g, '""')}"`
      return str
    }).join(',')
  )
  return BOM + header + '\r\n' + rows.join('\r\n')
}

function toJSON(data: any[]): string {
  return JSON.stringify(data, null, 2)
}

async function fetchAll(s: any, table: string, select: string, shopId: string): Promise<any[]> {
  const all: any[] = []
  let page = 0
  while (true) {
    const { data } = await s.from(table).select(select).eq('shop_id', shopId).range(page * 1000, (page + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < 1000) break
    page++
  }
  return all
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const perms = getPermissions(actor)
  if (!perms.canViewFinancials && !perms.canManageUsers) {
    return jsonError('Only shop owners can export data', 403)
  }

  const s = createAdminSupabaseClient()
  const { tables, format = 'csv' } = await req.json()

  if (!tables?.length) return NextResponse.json({ error: 'No tables selected' }, { status: 400 })

  const zip = new JSZip()
  const ext = format === 'json' ? '.json' : '.csv'
  const counts: Record<string, number> = {}

  for (const key of tables) {
    const config = TABLE_MAP[key]
    if (!config) continue

    try {
      const data = await fetchAll(s, config.table, config.select, shopId)
      counts[config.fileName] = data.length

      if (data.length === 0) continue

      const columns = config.select.split(',').map(c => c.trim())
      const content = format === 'json' ? toJSON(data) : toCSV(data, columns)
      zip.file(`${config.fileName}${ext}`, content)
    } catch (err: any) {
      counts[config.fileName] = -1
    }
  }

  // Log the export
  logAction({
    shop_id: shopId,
    user_id: actor.id,
    action: 'data.exported',
    entity_type: 'shop',
    entity_id: shopId,
    details: { tables, format, counts },
  }).catch(() => {})

  // Generate ZIP
  const zipBuffer = await zip.generateAsync({ type: 'uint8array' })

  // Get shop name for filename
  const { data: shop } = await s.from('shops').select('name, dba').eq('id', shopId).single()
  const shopName = (shop?.dba || shop?.name || 'shop').replace(/[^a-zA-Z0-9]/g, '_')
  const date = new Date().toISOString().split('T')[0]
  const fileName = `truckzen_export_${shopName}_${date}.zip`

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
