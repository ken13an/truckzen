import crypto from 'crypto'

const FULLBAY_BASE = 'https://app.fullbay.com/services'

// Fullbay auth: key + SHA1(key + YYYY-MM-DD + serverPublicIP)
async function getAuth(): Promise<{ key: string; token: string }> {
  const key = process.env.FULLBAY_API_KEY
  if (!key) throw new Error('FULLBAY_API_KEY not configured')

  const today = new Date().toISOString().split('T')[0]

  // Get server's public IP
  let ip = '0.0.0.0'
  try {
    const res = await fetch('https://api.ipify.org')
    ip = (await res.text()).trim()
  } catch {
    try { const res = await fetch('https://checkip.amazonaws.com'); ip = (await res.text()).trim() } catch {}
  }

  const token = crypto.createHash('sha1').update(key + today + ip).digest('hex')
  return { key, token }
}

async function fbFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const { key, token } = await getAuth()
  const qs = new URLSearchParams({ key, token, ...params }).toString()
  const url = `${FULLBAY_BASE}/${endpoint}?${qs}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fullbay ${endpoint} HTTP ${res.status}`)
  const data = await res.json()
  if (data.status !== 'SUCCESS') throw new Error(`Fullbay: ${data.status || 'Unknown error'}`)
  return data
}

// Paginate through date ranges (max 7 days per request)
async function fetchDateRange(endpoint: string, startDate: string, endDate: string): Promise<any[]> {
  const all: any[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  let cur = new Date(start)

  while (cur <= end) {
    const rangeEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, end.getTime()))
    const sD = cur.toISOString().split('T')[0]
    const eD = rangeEnd.toISOString().split('T')[0]
    try {
      let page = 1
      while (true) {
        const data = await fbFetch(endpoint, { startDate: sD, endDate: eD, page: String(page) })
        all.push(...(data.resultSet || []))
        if (page >= (data.totalPages || 1)) break
        page++
      }
    } catch (err: any) {
      console.error(`[Fullbay] ${endpoint} ${sD}-${eD}:`, err.message)
    }
    cur = new Date(cur.getTime() + 7 * 86400000)
  }
  return all
}

// ---- Public API ----

export async function testConnection(): Promise<{ ok: boolean; name?: string; count?: number; error?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const data = await fbFetch('getInvoices.php', { startDate: today, endDate: today })
    return { ok: true, name: 'Fullbay Connected', count: data.totalCount || data.resultCount || 0 }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function fetchInvoices(startDate: string, endDate: string): Promise<any[]> {
  return fetchDateRange('getInvoices.php', startDate, endDate)
}

export async function fetchAdjustments(startDate: string, endDate: string): Promise<any[]> {
  return fetchDateRange('getAdjustments.php', startDate, endDate)
}

export async function fetchPreview(type: string): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6)
  const start = weekAgo.toISOString().split('T')[0]

  const data = await fbFetch('getInvoices.php', { startDate: start, endDate: today })
  const invoices = data.resultSet || []

  if (type === 'invoices') return invoices.slice(0, 10)

  if (type === 'customers') {
    const seen = new Set<string>()
    return invoices.map((inv: any) => {
      const c = inv.ServiceOrder?.Customer || inv.Customer || {}
      const key = String(c.customerId || c.title || '')
      if (!key || seen.has(key)) return null
      seen.add(key)
      return mapCustomer(inv)
    }).filter(Boolean).slice(0, 10)
  }

  if (type === 'trucks') {
    const seen = new Set<string>()
    return invoices.map((inv: any) => {
      const u = inv.ServiceOrder?.Unit || {}
      const key = u.vin || u.number || ''
      if (!key || seen.has(key)) return null
      seen.add(key)
      return mapTruck(inv)
    }).filter(Boolean).slice(0, 10)
  }

  if (type === 'parts') {
    const parts: any[] = []
    const seen = new Set<string>()
    for (const inv of invoices) {
      for (const comp of inv.ServiceOrder?.Complaints || []) {
        for (const corr of comp.Corrections || []) {
          for (const p of corr.Parts || []) {
            const pn = p.shopPartNumber || p.vendorPartNumber || ''
            if (pn && !seen.has(pn)) { seen.add(pn); parts.push(mapPart(p)) }
          }
        }
      }
    }
    return parts.slice(0, 10)
  }

  return []
}

// ---- Field Mappers ----

export function mapCustomer(inv: any): Record<string, any> {
  const c = inv.ServiceOrder?.Customer || inv.Customer || {}
  const so = inv.ServiceOrder || {}
  return {
    company_name: c.title || inv.customerTitle || '',
    contact_name: so.authorizerContact || so.submitterContact || null,
    phone: c.mainPhone || so.authorizerContactPhone || null,
    email: so.authorizerContactEmail || so.submitterContactEmail || inv.customerBillingEmail || null,
    address: so.BillingAddress?.line1 || null,
    city: so.BillingAddress?.city || null,
    state: so.BillingAddress?.state || null,
    zip: so.BillingAddress?.postalCode || null,
    source: 'fullbay',
    external_id: String(c.customerId || ''),
  }
}

export function mapTruck(inv: any): Record<string, any> {
  const u = inv.ServiceOrder?.Unit || {}
  return {
    unit_number: u.number || '',
    vin: u.vin || null,
    year: parseInt(u.year) || null,
    make: u.make || null,
    model: u.model || null,
    unit_type: (u.type || '').toLowerCase() === 'trailer' ? 'trailer' : 'tractor',
    license_plate: u.licensePlate || null,
    status: 'active',
    source: 'fullbay',
    external_id: String(u.customerUnitId || ''),
  }
}

export function mapServiceOrder(inv: any): Record<string, any> {
  const so = inv.ServiceOrder || {}
  return {
    original_so_number: so.repairOrderNumber || '',
    concern: so.description || (so.Complaints?.[0]?.note || ''),
    status: 'done',
    priority: so.hot === 'Yes' ? 'high' : 'normal',
    source: 'fullbay',
    is_historical: true,
    created_at: so.created || inv.created || null,
    completed_at: so.completionDateTime || null,
    labor_total: parseFloat(so.laborTotal) || 0,
    parts_total: parseFloat(so.partsTotal) || 0,
    grand_total: parseFloat(inv.total) || 0,
  }
}

export function mapPart(p: any): Record<string, any> {
  return {
    part_number: p.shopPartNumber || p.vendorPartNumber || null,
    description: p.description || '',
    cost_price: parseFloat(p.cost) || 0,
    sell_price: parseFloat(p.sellingPrice) || 0,
    on_hand: 0, // Fullbay invoices show used quantity, not inventory
    vendor: null,
    bin_location: null,
  }
}

export function mapInvoice(inv: any): Record<string, any> {
  return {
    original_invoice_number: inv.invoiceNumber || '',
    status: parseFloat(inv.balance) > 0 ? 'sent' : 'paid',
    subtotal: parseFloat(inv.subTotal) || 0,
    tax_rate: parseFloat(inv.taxRate) || 0,
    tax_amount: parseFloat(inv.taxTotal) || 0,
    total: parseFloat(inv.total) || 0,
    amount_paid: (parseFloat(inv.total) || 0) - (parseFloat(inv.balance) || 0),
    balance_due: parseFloat(inv.balance) || 0,
    source: 'fullbay',
    is_historical: true,
    created_at: inv.invoiceDate || inv.created || null,
  }
}

// Extract unique records from invoice batch
export function extractCustomers(invoices: any[]): Map<string, Record<string, any>> {
  const map = new Map<string, Record<string, any>>()
  for (const inv of invoices) {
    const c = mapCustomer(inv)
    const key = c.external_id || c.company_name
    if (key && !map.has(key)) map.set(key, c)
  }
  return map
}

export function extractTrucks(invoices: any[]): Map<string, Record<string, any>> {
  const map = new Map<string, Record<string, any>>()
  for (const inv of invoices) {
    const t = mapTruck(inv)
    const key = t.vin || t.unit_number
    if (key && !map.has(key)) map.set(key, t)
  }
  return map
}

export function extractParts(invoices: any[]): Map<string, Record<string, any>> {
  const map = new Map<string, Record<string, any>>()
  for (const inv of invoices) {
    for (const comp of inv.ServiceOrder?.Complaints || []) {
      for (const corr of comp.Corrections || []) {
        for (const p of corr.Parts || []) {
          const mapped = mapPart(p)
          if (mapped.part_number && !map.has(mapped.part_number)) map.set(mapped.part_number, mapped)
        }
      }
    }
  }
  return map
}
