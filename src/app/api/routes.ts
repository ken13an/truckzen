// ============================================================
// TRUCKZEN — ALL API ROUTES
// Place each section in its corresponding file path
// ============================================================

// ── app/api/auth/login/route.ts ──────────────────────────────
/*
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email, password } = await req.json()
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ error: error.message }, { status: 401 })

  // Fetch user profile with role
  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, team, language, shop_id, avatar_color')
    .eq('id', data.user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found. Contact admin.' }, { status: 404 })

  return NextResponse.json({ user: data.user, profile, session: data.session })
}
*/

// ── app/api/service-orders/route.ts ─────────────────────────
/*
import { createServerSupabaseClient } from '@/lib/supabase'
import { getCurrentUser, isTechnician } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let query = supabase
    .from('service_orders')
    .select(`
      id, so_number, status, priority, source, team, bay,
      complaint, created_at, grand_total,
      assets(unit_number, year, make, model),
      customers(company_name),
      users!assigned_tech(full_name)
    `)
    .eq('shop_id', user.shop_id)
    .not('status', 'in', '("void")')
    .order('created_at', { ascending: false })

  // Technicians only see their team
  if (isTechnician(user.role) && user.team) {
    query = query.eq('team', user.team)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Generate SO number
  const { data: lastSO } = await supabase
    .from('service_orders')
    .select('so_number')
    .eq('shop_id', user.shop_id)
    .order('created_at', { ascending: false })
    .limit(1).single()

  const lastNum = lastSO?.so_number ? parseInt(lastSO.so_number.replace('SO-', '')) : 0
  const soNumber = `SO-${String(lastNum + 1).padStart(5, '0')}`

  const { data, error } = await supabase
    .from('service_orders')
    .insert({
      shop_id: user.shop_id,
      so_number: soNumber,
      ...body,
      advisor_id: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log audit
  await supabase.from('audit_log').insert({
    shop_id: user.shop_id,
    user_id: user.id,
    action: 'so.created',
    table_name: 'service_orders',
    record_id: data.id,
    new_data: data,
  })

  return NextResponse.json({ data }, { status: 201 })
}
*/

// ── app/api/service-orders/[id]/route.ts ────────────────────
/*
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data: existing } = await supabase
    .from('service_orders').select('*').eq('id', params.id).single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Technician team check
  if (isTechnician(user.role) && existing.team !== user.team) {
    return NextResponse.json({ error: 'Access denied — wrong team' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('service_orders').update(body).eq('id', params.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await supabase.from('audit_log').insert({
    shop_id: user.shop_id, user_id: user.id,
    action: 'so.updated', table_name: 'service_orders',
    record_id: params.id, old_data: existing, new_data: data,
  })

  return NextResponse.json({ data })
}
*/

// ── app/api/telegram/route.ts ────────────────────────────────
// This is where the Telegram bot webhook handler goes
// Import and re-export from telegram-bot/index.js
/*
export { default as POST } from '@/telegram-bot'
*/

// ── app/api/ai/service-writer/route.ts ──────────────────────
/*
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transcript, language, truck_info, complaint } = await req.json()

  const langNames: Record<string, string> = {
    en: 'English', ru: 'Russian', uz: 'Uzbek', es: 'Spanish'
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    system: `You are an expert heavy truck service writer for a professional repair shop.
You receive transcripts from mechanics who may speak Russian, Uzbek, Spanish, or English.
Your job is to generate professional, technical service notes in English for the official shop record.

Always return a JSON object with exactly these fields:
{
  "cause": "Professional technical cause statement in English (2-3 sentences)",
  "correction": "Professional correction/repair procedure in English (2-4 sentences)",
  "cause_native": "Same cause statement in ${langNames[language] || 'English'} if different from English, null if English",
  "correction_native": "Same correction in ${langNames[language] || 'English'} if different from English, null if English",
  "suggested_parts": ["part 1", "part 2"],
  "labor_hours_estimate": 0.0
}`,
    messages: [{
      role: 'user',
      content: `Truck: ${truck_info?.year} ${truck_info?.make} ${truck_info?.model}
Customer complaint: ${complaint || 'Not provided'}
Mechanic voice transcript (${langNames[language]}): "${transcript}"

Generate the service notes.`
    }]
  })

  const text = response.content[0].text.trim()
  try {
    const clean = text.replace(/\`\`\`json\n?/g, '').replace(/\`\`\`\n?/g, '')
    const result = JSON.parse(clean)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'AI parsing failed' }, { status: 500 })
  }
}
*/

// ── app/api/stripe/webhook/route.ts ─────────────────────────
/*
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const invoiceId = pi.metadata.invoice_id

    if (invoiceId) {
      await supabase.from('invoices').update({
        status: 'paid',
        amount_paid: pi.amount_received / 100,
        payment_method: 'card',
        stripe_payment_intent: pi.id,
        paid_at: new Date().toISOString(),
      }).eq('id', invoiceId)
    }
  }

  return NextResponse.json({ received: true })
}
*/

// ── app/api/kiosk/checkin/route.ts ───────────────────────────
/*
export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { unit_number, complaint_raw, complaint_lang, complaint_en, shop_id } = await req.json()

  // Find existing asset
  const { data: asset } = await supabase
    .from('assets').select('id, customer_id')
    .eq('shop_id', shop_id)
    .ilike('unit_number', unit_number)
    .single()

  const ref = `CI-${new Date().getFullYear()}-${Math.floor(Math.random()*9000)+1000}`

  const { data: checkin } = await supabase.from('kiosk_checkins').insert({
    shop_id,
    asset_id: asset?.id || null,
    customer_id: asset?.customer_id || null,
    unit_number,
    complaint_raw,
    complaint_lang,
    complaint_en,
    checkin_ref: ref,
  }).select().single()

  // Notify service advisor via SMS (Twilio)
  // await notifyAdvisor(checkin)

  return NextResponse.json({ ref, checkin })
}
*/

export {}
