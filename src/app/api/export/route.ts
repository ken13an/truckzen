import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function toCSV(rows: any[], columns: string[]): string {
  const header = columns.join(',')
  const lines = rows.map(row =>
    columns.map(col => {
      const val = String(row[col] ?? '')
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val
    }).join(',')
  )
  return [header, ...lines].join('\n')
}

// GET /api/export?shop_id=...&type=...&columns=...&format=csv
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const type = searchParams.get('type')
  const cols = searchParams.get('columns')?.split(',') || []
  const userId = searchParams.get('user_id')
  const userName = searchParams.get('user_name')

  if (!shopId || !type) return NextResponse.json({ error: 'shop_id and type required' }, { status: 400 })

  let data: any[] = []
  let allCols: string[] = []

  switch (type) {
    case 'customers': {
      const { data: rows } = await s.from('customers').select('company_name, contact_name, phone, email, address, notes, source, visit_count, total_spent, created_at').eq('shop_id', shopId).order('company_name')
      data = rows || []
      // Enrich with unit count and invoice data
      const { data: assets } = await s.from('assets').select('customer_id').eq('shop_id', shopId)
      const { data: invoices } = await s.from('invoices').select('customer_id, total, balance_due, status').eq('shop_id', shopId)
      const { data: custIds } = await s.from('customers').select('id, company_name').eq('shop_id', shopId)
      const idMap = new Map((custIds || []).map((c: any) => [c.company_name, c.id]))

      data = data.map(c => {
        const cid = idMap.get(c.company_name)
        const units = (assets || []).filter((a: any) => a.customer_id === cid).length
        const custInvs = (invoices || []).filter((i: any) => i.customer_id === cid)
        const totalInvoices = custInvs.length
        const balanceDue = custInvs.filter((i: any) => i.status !== 'paid' && i.status !== 'void').reduce((s: number, i: any) => s + (i.balance_due || i.total - (i.amount_paid || 0) || 0), 0)
        return { ...c, unit_count: units, total_invoices: totalInvoices, balance_due: balanceDue.toFixed(2) }
      })
      allCols = ['company_name', 'contact_name', 'phone', 'email', 'address', 'unit_count', 'total_invoices', 'balance_due', 'visit_count', 'total_spent', 'source', 'notes', 'created_at']
      break
    }
    case 'vehicles': {
      const { data: rows } = await s.from('assets').select('unit_number, asset_type, status, year, make, model, vin, license_plate, odometer, engine_hours, customers(company_name), created_at').eq('shop_id', shopId).order('unit_number')
      data = (rows || []).map((r: any) => ({ ...r, customer: (r.customers as any)?.company_name || '' }))
      allCols = ['unit_number', 'asset_type', 'status', 'year', 'make', 'model', 'vin', 'license_plate', 'odometer', 'engine_hours', 'customer', 'created_at']
      break
    }
    case 'parts': {
      const { data: rows } = await s.from('parts').select('part_number, description, category, on_hand, reserved, reorder_point, cost_price, sell_price, vendor, bin_location, created_at').eq('shop_id', shopId).order('description')
      data = rows || []
      allCols = ['part_number', 'description', 'category', 'on_hand', 'reserved', 'reorder_point', 'cost_price', 'sell_price', 'vendor', 'bin_location', 'created_at']
      break
    }
    case 'invoices': {
      const { data: rows } = await s.from('invoices').select('invoice_number, status, subtotal, tax_amount, total, amount_paid, balance_due, payment_method, due_date, paid_at, created_at, customers(company_name)').eq('shop_id', shopId).order('created_at', { ascending: false })
      data = (rows || []).map((r: any) => ({ ...r, customer: (r.customers as any)?.company_name || '' }))
      allCols = ['invoice_number', 'customer', 'status', 'subtotal', 'tax_amount', 'total', 'amount_paid', 'balance_due', 'payment_method', 'due_date', 'paid_at', 'created_at']
      break
    }
    case 'service_orders': {
      const { data: rows } = await s.from('service_orders').select('so_number, status, source, priority, complaint, cause, correction, labor_total, parts_total, tax_total, grand_total, created_at, completed_at, assets(unit_number), customers(company_name), users!assigned_tech(full_name)').eq('shop_id', shopId).order('created_at', { ascending: false })
      data = (rows || []).map((r: any) => ({
        ...r,
        unit_number: (r.assets as any)?.unit_number || '',
        customer: (r.customers as any)?.company_name || '',
        technician: (r.users as any)?.full_name || '',
      }))
      allCols = ['so_number', 'unit_number', 'customer', 'technician', 'status', 'priority', 'complaint', 'cause', 'correction', 'labor_total', 'parts_total', 'tax_total', 'grand_total', 'created_at', 'completed_at']
      break
    }
    default:
      return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
  }

  const exportCols = cols.length > 0 ? cols.filter(c => allCols.includes(c)) : allCols

  // Log the export
  if (userId) {
    await s.from('import_export_log').insert({
      shop_id: shopId, user_id: userId, user_name: userName,
      action: 'export', data_type: type, record_count: data.length, file_name: `${type}-export.csv`,
    })
  }

  const csv = toCSV(data, exportCols)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${type}-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
