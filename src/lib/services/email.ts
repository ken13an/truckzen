import { Resend } from 'resend'

let resend: Resend | null = null
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY!)
  return resend
}

export async function sendEmail(to: string | string[], subject: string, html: string): Promise<boolean> {
  try {
    const r = getResend()
    const { error } = await r.emails.send({
      from: process.env.EMAIL_FROM || 'TruckZen <no-reply@truckzen.pro>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })
    if (error) { console.error('[Email] Send failed:', error); return false }
    return true
  } catch (err) {
    console.error('[Email] Error:', err)
    return false
  }
}

export async function getStaffEmails(shopId: string, role: string): Promise<string[]> {
  const { createClient } = await import('@supabase/supabase-js')
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await s.from('users').select('email').eq('shop_id', shopId).eq('role', role).is('deleted_at', null).not('email', 'is', null)
  return (data || []).map((u: any) => u.email).filter(Boolean)
}

export async function getShopInfo(shopId: string): Promise<{ name: string; phone: string; email: string; address: string; logoUrl: string | null }> {
  const { createClient } = await import('@supabase/supabase-js')
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await s.from('shops').select('name, dba, phone, email, address, city, state, zip, logo_url').eq('id', shopId).single()
  if (!data) return { name: 'TruckZen', phone: '', email: '', address: '', logoUrl: null }
  return {
    name: data.dba || data.name || 'TruckZen',
    phone: data.phone || '',
    email: data.email || '',
    address: [data.address, data.city, data.state, data.zip].filter(Boolean).join(', '),
    logoUrl: data.logo_url || null,
  }
}
