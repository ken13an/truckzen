// lib/integrations/quickbooks.ts
// QuickBooks Online OAuth 2.0 + Invoice sync
// Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const QBO_BASE   = 'https://quickbooks.api.intuit.com/v3/company'
const OAUTH_URL  = 'https://appcenter.intuit.com/connect/oauth2'
const TOKEN_URL  = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

function getQboConfig() {
  // Production env names are QUICKBOOKS_* (existing in Vercel). Local/dev
  // setups may have used QBO_* — keep that as a fallback. Fail with a
  // generic message if required values are absent (do not name which
  // var is missing in user-facing errors; logs may name it).
  const clientId = process.env.QUICKBOOKS_CLIENT_ID || process.env.QBO_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || process.env.QBO_CLIENT_SECRET
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI
    || process.env.QBO_REDIRECT_URI
    || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/qbo/callback`
  if (!clientId || !clientSecret) {
    throw new Error('QBO is not configured')
  }
  return { clientId, clientSecret, redirectUri }
}

// ── OAUTH FLOW ──────────────────────────────────────────────
// `signedState` must come from signQboState() — it binds the QBO
// authorize → callback round-trip to the actor + shop. Raw shopId is no
// longer accepted as state.
export function getAuthUrl(signedState: string): string {
  const { clientId, redirectUri } = getQboConfig()
  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: 'code',
    scope:         'com.intuit.quickbooks.accounting',
    redirect_uri:  redirectUri,
    state:         signedState,
  })
  return `${OAUTH_URL}?${params}`
}

export async function exchangeCodeForTokens(code: string, shopId: string): Promise<boolean> {
  const { clientId, clientSecret, redirectUri } = getQboConfig()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) return false
  const tokens = await res.json()

  await getSupabase().from('shops').update({
    qbo_access_token:   tokens.access_token,
    qbo_refresh_token:  tokens.refresh_token,
    qbo_token_expiry:   new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    qbo_realm_id:       tokens.realmId || null,
    qbo_connected:      true,
  }).eq('id', shopId)

  return true
}

async function getValidToken(shopId: string): Promise<{ token: string; realmId: string } | null> {
  const { clientId, clientSecret } = getQboConfig()
  const { data: shop } = await getSupabase().from('shops')
    .select('qbo_access_token, qbo_refresh_token, qbo_token_expiry, qbo_realm_id')
    .eq('id', shopId).single()

  if (!shop?.qbo_access_token) return null

  // Refresh if expiring in less than 5 minutes
  if (new Date(shop.qbo_token_expiry) < new Date(Date.now() + 5 * 60 * 1000)) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: shop.qbo_refresh_token }),
    })
    if (!res.ok) return null
    const tokens = await res.json()
    await getSupabase().from('shops').update({
      qbo_access_token:  tokens.access_token,
      qbo_refresh_token: tokens.refresh_token || shop.qbo_refresh_token,
      qbo_token_expiry:  new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }).eq('id', shopId)
    return { token: tokens.access_token, realmId: shop.qbo_realm_id }
  }

  return { token: shop.qbo_access_token, realmId: shop.qbo_realm_id }
}

// ── PUSH INVOICE TO QBO ─────────────────────────────────────
export async function pushInvoiceToQBO(invoiceId: string, shopId: string): Promise<{ success: boolean; qbo_id?: string; error?: string }> {
  const auth = await getValidToken(shopId)
  if (!auth) return { success: false, error: 'QuickBooks not connected' }

  const { data: inv } = await getSupabase()
    .from('invoices')
    .select(`
      invoice_number, subtotal, tax_amount, total, due_date,
      customers(company_name, email),
      so_lines(line_type, description, quantity, unit_price, total_price)
    `)
    .eq('id', invoiceId).single()

  if (!inv) return { success: false, error: 'Invoice not found' }

  // Find or create QBO customer
  const customerName = (inv.customers as any)?.company_name || 'Unknown Customer'
  const customerRes  = await fetch(`${QBO_BASE}/${auth.realmId}/query?query=SELECT * FROM Customer WHERE DisplayName='${encodeURIComponent(customerName)}'`, {
    headers: { 'Authorization': `Bearer ${auth.token}`, 'Accept': 'application/json' },
  })
  const customerData = await customerRes.json()
  const qboCustomer  = customerData.QueryResponse?.Customer?.[0]

  const lines = ((inv as any).so_lines || []).map((l: any, i: number) => ({
    LineNum:       i + 1,
    Amount:        l.total_price || 0,
    DetailType:    'SalesItemLineDetail',
    SalesItemLineDetail: {
      Qty:        l.quantity,
      UnitPrice:  l.unit_price,
      ItemRef:    { value: '1', name: l.line_type === 'labor' ? 'Labor' : 'Parts' },
    },
    Description: l.description,
  }))

  const qboInvoice = {
    Line:       lines,
    DocNumber:  (inv as any).invoice_number,
    DueDate:    (inv as any).due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    ...(qboCustomer ? { CustomerRef: { value: qboCustomer.Id, name: qboCustomer.DisplayName } } : {}),
    TxnTax: { TotalTax: (inv as any).tax_amount || 0 },
  }

  const pushRes = await fetch(`${QBO_BASE}/${auth.realmId}/invoice`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify(qboInvoice),
  })

  if (!pushRes.ok) {
    const err = await pushRes.json()
    return { success: false, error: err.Fault?.Error?.[0]?.Detail || 'QBO push failed' }
  }

  const result = await pushRes.json()
  const qboId  = result.Invoice?.Id

  // Save QBO ID back to invoice
  if (qboId) {
    await getSupabase().from('invoices').update({ qbo_invoice_id: qboId, qbo_synced: true }).eq('id', invoiceId)
  }

  return { success: true, qbo_id: qboId }
}

// ── PUSH BILL (PO) TO QBO ────────────────────────────────────
export async function pushBillToQBO(poId: string, shopId: string): Promise<{ success: boolean; qbo_id?: string; error?: string }> {
  const auth = await getValidToken(shopId)
  if (!auth) return { success: false, error: 'QuickBooks not connected' }

  const { data: po } = await getSupabase()
    .from('purchase_orders')
    .select('po_number, total, vendors(name), po_lines(description, quantity, unit_cost, total_cost)')
    .eq('id', poId).single()

  if (!po) return { success: false, error: 'PO not found' }

  const lines = ((po as any).po_lines || []).map((l: any, i: number) => ({
    LineNum:    i + 1,
    Amount:     l.total_cost || 0,
    DetailType: 'ItemBasedExpenseLineDetail',
    ItemBasedExpenseLineDetail: {
      Qty:       l.quantity,
      UnitPrice: l.unit_cost,
      ItemRef:   { value: '2', name: 'Parts' },
    },
    Description: l.description,
  }))

  const bill = {
    Line:       lines,
    DocNumber:  (po as any).po_number,
    VendorRef:  { name: (po as any).vendors?.name || 'Vendor' },
    TotalAmt:   (po as any).total || 0,
  }

  const res = await fetch(`${QBO_BASE}/${auth.realmId}/bill`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify(bill),
  })

  if (!res.ok) return { success: false, error: 'QBO bill push failed' }
  const result = await res.json()
  return { success: true, qbo_id: result.Bill?.Id }
}
