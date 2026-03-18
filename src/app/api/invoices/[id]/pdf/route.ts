import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { generateInvoiceHTML } from '@/lib/pdf/invoice'
import { generatePaymentQR } from '@/lib/payments/qr'

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: inv } = await supabase
    .from('invoices')
    .select(`
      *, 
      service_orders(so_number, complaint, cause, correction,
        assets(unit_number, year, make, model, odometer),
        users!assigned_tech(full_name),
        so_lines(line_type, description, part_number, quantity, unit_price, total_price)
      ),
      customers(company_name, contact_name, phone, email, address, city, state, zip),
      shops(name, dba, phone, email, address, city, state, zip)
    `)
    .eq('id', id)
    .eq('shop_id', user.shop_id)
    .single()

  if (!inv) return new Response('Not found', { status: 404 })

  const so    = inv.service_orders as any
  const asset = so?.assets as any
  const shop  = inv.shops as any
  const cust  = inv.customers as any

  // Generate QR code URL
  let paymentUrl: string | undefined
  let qrCodeUrl:  string | undefined
  if (inv.balance_due > 0) {
    try {
      const qr = await generatePaymentQR(id)
      paymentUrl = qr.paymentUrl
      qrCodeUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(paymentUrl)}&bgcolor=ffffff&color=1a1a2e`
    } catch { /* non-critical */ }
  }

  const html = generateInvoiceHTML({
    shop:    { name: shop?.name, dba: shop?.dba, phone: shop?.phone, email: shop?.email, address: shop?.address, city: shop?.city, state: shop?.state, zip: shop?.zip },
    customer:{ company_name: cust?.company_name, contact_name: cust?.contact_name, phone: cust?.phone, email: cust?.email, address: cust?.address },
    invoice: { invoice_number: inv.invoice_number, due_date: inv.due_date, subtotal: inv.subtotal, tax_amount: inv.tax_amount || 0, total: inv.total, balance_due: inv.balance_due, amount_paid: inv.amount_paid || 0, notes: inv.notes },
    serviceOrder: {
      so_number: so?.so_number, complaint: so?.complaint, cause: so?.cause, correction: so?.correction,
      truck_unit: asset?.unit_number, truck_year: asset?.year, truck_make: asset?.make, truck_model: asset?.model,
      odometer: asset?.odometer, technician_name: so?.users?.full_name,
    },
    lines:       so?.so_lines || [],
    paymentUrl,
    qrCodeUrl,
  })

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
