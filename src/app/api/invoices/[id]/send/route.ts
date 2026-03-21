// app/api/invoices/[id]/send/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { sendInvoiceEmail } from '@/lib/integrations/resend'
import { generatePaymentQR } from '@/lib/payments/qr'
import { logAction } from '@/lib/services/auditLog'

type P = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: P) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: inv } = await supabase
    .from('invoices')
    .select(`*, service_orders(so_number, complaint, cause, correction, assets(unit_number,year,make,model,odometer), users!assigned_tech(full_name), so_lines(line_type, description, part_number, quantity, unit_price, total_price)), customers(company_name,contact_name,email,phone), shops(name,dba,phone,email,address)`)
    .eq('id', id).eq('shop_id', user.shop_id).single()

  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(inv.customers as any)?.email) return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 })

  // Generate QR payment link
  let paymentUrl: string | undefined
  try {
    const qr = await generatePaymentQR(id)
    paymentUrl = qr.paymentUrl
  } catch { /* non-critical */ }

  const so    = inv.service_orders as any
  const shop  = inv.shops as any
  const asset = so?.assets

  const emailData = {
    shop:        { name: shop?.name, dba: shop?.dba, phone: shop?.phone, email: shop?.email, address: shop?.address },
    customer:    { company_name: (inv.customers as any).company_name, contact_name: (inv.customers as any).contact_name, email: (inv.customers as any).email },
    invoice:     { invoice_number: inv.invoice_number, due_date: inv.due_date, subtotal: inv.subtotal, tax_amount: inv.tax_amount, total: inv.total, amount_paid: inv.amount_paid, balance_due: inv.balance_due, notes: inv.notes },
    serviceOrder:{ so_number: so?.so_number, complaint: so?.complaint, cause: so?.cause, correction: so?.correction, truck_unit: asset?.unit_number, truck_make_model: `${asset?.year} ${asset?.make} ${asset?.model}`, technician_name: so?.users?.full_name, odometer_in: asset?.odometer },
    lines:       so?.so_lines || [],
    paymentUrl,
  }

  const result = await sendInvoiceEmail(emailData)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

  // Mark as sent
  await supabase.from('invoices').update({ status: 'sent' }).eq('id', id)

  // Fire and forget
  logAction({ shop_id: user.shop_id, user_id: user.id, action: 'invoice.sent', entity_type: 'invoice', entity_id: id }).catch(() => {})

  return NextResponse.json({ success: true, messageId: result.id })
}
