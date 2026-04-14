/**
 * TruckZen — Canonical outbound invoice recipient resolver (Patch 125).
 *
 * For maintained-but-owner-paid trucks, invoices.customer_id points at the
 * maintenance company; the actual owner/operator who pays is captured on
 * the most recent kiosk_checkins row for the work order. This helper is the
 * single source of truth for deciding who receives the outbound invoice
 * email. It must be used by every outbound-email caller so that accounting
 * manual send and auto-completion notifications cannot silently diverge.
 *
 * Maintenance in-app visibility via /maintenance/invoices is session-based
 * and unrelated to this function.
 */
export async function resolveInvoiceRecipientEmail(
  supabase: { from: (table: string) => any },
  soId: string | null | undefined,
  customerEmail: string | null | undefined,
): Promise<string | null> {
  if (soId) {
    const { data: checkin } = await supabase.from('kiosk_checkins')
      .select('contact_email')
      .eq('wo_id', soId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (checkin?.contact_email) return checkin.contact_email
  }
  return customerEmail || null
}
