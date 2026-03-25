import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getShopInfo, getStaffEmails } from '@/lib/services/email'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { action, token, reason } = body

  if (!action || !token) return NextResponse.json({ error: 'action and token required' }, { status: 400 })
  if (!['approve', 'approve_with_notes', 'decline'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const supabase = db()

  // Get estimate and verify token
  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
  if (estimate.approval_token !== token) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })

  // Check if already responded
  if (estimate.status === 'approved' || estimate.status === 'declined') {
    return NextResponse.json({ error: 'Estimate already responded to', status: estimate.status }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { notes: customerNotes } = body

  if (action === 'approve') {
    await supabase.from('estimates').update({
      status: 'approved',
      responded_at: now,
      approval_method: 'email_portal',
      approved_by: estimate.customer_name || 'Customer',
      updated_at: now,
    }).eq('id', id)

    // Mark all lines as approved
    await supabase.from('estimate_lines').update({ is_approved: true }).eq('estimate_id', id)

    // Update WO
    if (estimate.repair_order_id) {
      await supabase.from('service_orders').update({
        estimate_approved: true,
        estimate_status: 'approved',
        approval_method: 'email_portal',
        updated_at: now,
      }).eq('id', estimate.repair_order_id)
    }
  } else if (action === 'approve_with_notes') {
    await supabase.from('estimates').update({
      status: 'approved_with_notes',
      responded_at: now,
      approval_method: 'email_portal',
      approved_by: estimate.customer_name || 'Customer',
      customer_notes: customerNotes || '',
      updated_at: now,
    }).eq('id', id)

    // Mark all lines as approved (service writer will review notes and adjust)
    await supabase.from('estimate_lines').update({ is_approved: true }).eq('estimate_id', id)

    // Update WO with notes status
    if (estimate.repair_order_id) {
      await supabase.from('service_orders').update({
        estimate_approved: true,
        estimate_status: 'approved_with_notes',
        approval_method: 'email_portal',
        customer_estimate_notes: customerNotes || '',
        updated_at: now,
      }).eq('id', estimate.repair_order_id)
    }
  } else {
    // Decline - save reason to notes
    const existingNotes = estimate.notes || ''
    const declineNote = reason ? `[DECLINED] ${reason}` : '[DECLINED] No reason provided'
    const updatedNotes = existingNotes ? `${existingNotes}\n${declineNote}` : declineNote

    await supabase.from('estimates').update({
      status: 'declined',
      responded_at: now,
      notes: updatedNotes,
      decline_reason: reason || null,
      updated_at: now,
    }).eq('id', id)

    // Update WO
    if (estimate.repair_order_id) {
      await supabase.from('service_orders').update({
        estimate_status: 'declined',
        estimate_declined_reason: reason || null,
        updated_at: now,
      }).eq('id', estimate.repair_order_id)
    }
  }

  // Fire-and-forget: email notification to service writers
  const shop = await getShopInfo(estimate.shop_id)
  const staffEmails = await getStaffEmails(estimate.shop_id, 'service_writer')
  const ownerEmails = await getStaffEmails(estimate.shop_id, 'owner')
  const allEmails = [...new Set([...staffEmails, ...ownerEmails])].filter(Boolean)

  if (allEmails.length > 0) {
    const statusText = action === 'approve' ? 'APPROVED' : action === 'approve_with_notes' ? 'APPROVED WITH NOTES' : 'DECLINED'
    const statusColor = action === 'decline' ? '#DC2626' : action === 'approve_with_notes' ? '#D97706' : '#16A34A'
    const emailHtml = `
      <div style="background:#0f0f1a;padding:32px;font-family:-apple-system,sans-serif">
        <div style="max-width:500px;margin:0 auto;background:#1a1a2e;border-radius:12px;overflow:hidden">
          <div style="padding:20px 24px;background:#1d1d35;border-bottom:1px solid #2a2a3a">
            <h2 style="margin:0;color:#fff;font-size:16px">Estimate ${estimate.estimate_number} ${statusText}</h2>
          </div>
          <div style="padding:24px">
            <p style="color:#e0e0e0;font-size:14px;margin:0 0 8px">
              <strong>${estimate.customer_name || 'Customer'}</strong> has
              <span style="color:${statusColor};font-weight:700">${statusText.toLowerCase()}</span>
              estimate ${estimate.estimate_number}.
            </p>
            <p style="color:#b0b0c0;font-size:13px;margin:0 0 4px">Total: $${(estimate.total || 0).toFixed(2)}</p>
            ${reason ? `<p style="color:#b0b0c0;font-size:13px;margin:8px 0 0">Reason: ${reason}</p>` : ''}
            ${action === 'approve_with_notes' && customerNotes ? `<p style="color:#D97706;font-size:13px;margin:8px 0 0;font-weight:700">Customer notes: ${customerNotes}</p>` : ''}
          </div>
        </div>
      </div>
    `
    sendEmail(allEmails, `Estimate ${estimate.estimate_number} ${statusText} - ${shop.name}`, emailHtml).catch(() => {})
  }

  // Fire-and-forget: push notification (insert into notifications table if it exists)
  const notifType = action === 'approve' || action === 'approve_with_notes' ? 'estimate_approved' : 'estimate_declined'
  const notifTitle = action === 'approve_with_notes'
    ? `Estimate ${estimate.estimate_number} approved WITH NOTES — review before starting`
    : `Estimate ${estimate.estimate_number} ${action === 'approve' ? 'approved' : 'declined'}`
  const notifBody = action === 'approve_with_notes'
    ? `${estimate.customer_name || 'Customer'} approved with notes: ${customerNotes || '(no notes)'}`
    : `${estimate.customer_name || 'Customer'} ${action === 'approve' ? 'approved' : 'declined'} estimate ${estimate.estimate_number}${reason ? ': ' + reason : ''}`
  supabase.from('notifications').insert({
    shop_id: estimate.shop_id,
    type: notifType,
    title: notifTitle,
    body: notifBody,
    data: { estimate_id: id },
  }).then(() => {})

  const resultStatus = action === 'approve' ? 'approved' : action === 'approve_with_notes' ? 'approved_with_notes' : 'declined'
  return NextResponse.json({ success: true, status: resultStatus })
}
