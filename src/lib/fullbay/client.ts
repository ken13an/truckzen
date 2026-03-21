const FULLBAY_BASE = 'https://app.fullbay.com/api/v1'

function getHeaders(): Record<string, string> {
  const key = process.env.FULLBAY_API_KEY
  if (!key) throw new Error('FULLBAY_API_KEY not configured')
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

async function fbFetch(path: string): Promise<any> {
  const res = await fetch(`${FULLBAY_BASE}${path}`, { headers: getHeaders() })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Fullbay API error ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// Try multiple possible endpoints for each resource
async function tryEndpoints(paths: string[]): Promise<any> {
  for (const path of paths) {
    try {
      return await fbFetch(path)
    } catch (err: any) {
      if (!err.message.includes('404')) throw err
      // Try next endpoint
    }
  }
  throw new Error('No working endpoint found')
}

export async function testConnection(): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const data = await tryEndpoints(['/me', '/account', '/shop', '/company', '/'])
    return { ok: true, name: data.name || data.company_name || data.shop_name || 'Fullbay Account' }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

// Paginate through all records
async function fetchAll(basePath: string, maxPages: number = 100): Promise<any[]> {
  const all: any[] = []
  for (let page = 1; page <= maxPages; page++) {
    try {
      const sep = basePath.includes('?') ? '&' : '?'
      const data = await fbFetch(`${basePath}${sep}page=${page}&per_page=100`)
      // Handle different response shapes
      const records = Array.isArray(data) ? data : data.data || data.results || data.items || []
      if (records.length === 0) break
      all.push(...records)
      // Check if we've reached the end
      const total = data.total || data.total_count || data.meta?.total
      if (total && all.length >= total) break
    } catch {
      break
    }
  }
  return all
}

export async function fetchCustomers(): Promise<any[]> {
  return fetchAll('/customers')
}

export async function fetchTrucks(): Promise<any[]> {
  return fetchAll('/units')  // Fullbay calls them "units"
}

export async function fetchParts(): Promise<any[]> {
  return fetchAll('/parts')
}

export async function fetchPreview(type: 'customers' | 'trucks' | 'parts', limit: number = 10): Promise<any[]> {
  const paths: Record<string, string> = { customers: '/customers', trucks: '/units', parts: '/parts' }
  const data = await fbFetch(`${paths[type]}?page=1&per_page=${limit}`)
  const records = Array.isArray(data) ? data : data.data || data.results || data.items || []
  return records.slice(0, limit)
}

// Map Fullbay fields to TruckZen fields
export function mapCustomer(fb: any): Record<string, any> {
  return {
    company_name: fb.company_name || fb.name || fb.customer_name || '',
    contact_name: fb.contact_name || fb.primary_contact || fb.contact || null,
    phone: fb.phone || fb.phone_number || fb.primary_phone || null,
    email: fb.email || fb.primary_email || null,
    address: fb.address || fb.street_address || fb.address_line_1 || null,
    city: fb.city || null,
    state: fb.state || null,
    zip: fb.zip || fb.zip_code || fb.postal_code || null,
    dot_number: fb.dot_number || fb.dot || null,
    mc_number: fb.mc_number || fb.mc || null,
    source: 'fullbay',
    external_id: String(fb.id || fb.customer_id || ''),
  }
}

export function mapTruck(fb: any): Record<string, any> {
  return {
    unit_number: fb.unit_number || fb.name || fb.unit_name || fb.number || '',
    vin: fb.vin || fb.vin_number || null,
    year: parseInt(fb.year || fb.model_year) || null,
    make: fb.make || fb.manufacturer || null,
    model: fb.model || null,
    unit_type: (fb.type || fb.unit_type || fb.vehicle_type || 'tractor').toLowerCase(),
    odometer: parseInt(fb.odometer || fb.mileage || fb.current_mileage) || null,
    license_plate: fb.license_plate || fb.plate || fb.tag || null,
    status: 'active',
    source: 'fullbay',
    external_id: String(fb.id || fb.unit_id || ''),
  }
}

export function mapPart(fb: any): Record<string, any> {
  return {
    part_number: fb.part_number || fb.sku || fb.item_number || null,
    description: fb.description || fb.name || fb.part_name || '',
    category: fb.category || fb.part_category || null,
    cost_price: parseFloat(fb.cost || fb.cost_price || fb.purchase_price || 0) || 0,
    sell_price: parseFloat(fb.price || fb.sell_price || fb.retail_price || fb.list_price || 0) || 0,
    on_hand: parseInt(fb.quantity || fb.qty || fb.on_hand || fb.quantity_on_hand || 0) || 0,
    vendor: fb.vendor || fb.supplier || null,
    bin_location: fb.bin || fb.location || fb.bin_location || null,
    source: 'fullbay',
  }
}
