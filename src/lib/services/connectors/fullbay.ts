import type {
  MigrationConnector,
  ConnectionTestResult,
  RawCustomer,
  RawVehicle,
  RawServiceOrder,
  RawInvoice,
  RawPart,
  RawTechnician,
} from './base'

const BASE_URL = 'https://app.fullbay.com/api/v1'

async function fbFetch(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Fullbay API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

async function fbPaginate(path: string, apiKey: string, dataKey?: string): Promise<any[]> {
  const all: any[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    let data: any
    try {
      data = await fbFetch(`${path}${sep}page=${page}&per_page=${perPage}`, apiKey)
    } catch (err) {
      console.error(`[Fullbay] Error fetching ${path} page ${page}:`, err)
      break
    }
    if (!data) break

    // Fullbay may return data in various shapes
    const items = dataKey ? data[dataKey] : (Array.isArray(data) ? data : data.data || data.results || data.items || [])
    if (!Array.isArray(items) || items.length === 0) break

    all.push(...items)

    // Stop if we got fewer than a full page
    if (items.length < perPage) break
    page++

    // Safety limit: 200 pages = 20,000 records
    if (page > 200) break
  }

  return all
}

function safeStr(val: any): string | undefined {
  if (val == null || val === '') return undefined
  return String(val).trim()
}

function safeNum(val: any): number | undefined {
  if (val == null || val === '') return undefined
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return isNaN(n) ? undefined : n
}

export const fullbayConnector: MigrationConnector = {
  name: 'fullbay',

  async testConnection(apiKey: string): Promise<ConnectionTestResult> {
    try {
      // Try common endpoints to find shop info
      const shopData = await fbFetch('/shop', apiKey)
        || await fbFetch('/account', apiKey)
        || await fbFetch('/settings', apiKey)

      const shopName = shopData?.name || shopData?.shop_name || shopData?.company_name || 'Fullbay Shop'

      // Try to get counts from various likely endpoints
      const counts: Record<string, number> = {}
      const endpoints = [
        { key: 'customers', paths: ['/customers', '/clients'] },
        { key: 'vehicles', paths: ['/vehicles', '/units', '/equipment'] },
        { key: 'service_orders', paths: ['/service-orders', '/work-orders', '/repairs'] },
        { key: 'invoices', paths: ['/invoices'] },
      ]

      for (const ep of endpoints) {
        for (const path of ep.paths) {
          try {
            const data = await fbFetch(`${path}?page=1&per_page=1`, apiKey)
            if (data) {
              counts[ep.key] = data.total || data.total_count || data.count || 0
              break
            }
          } catch {
            // Try next path
          }
        }
      }

      return { ok: true, shopName, counts }
    } catch (err: any) {
      return {
        ok: false,
        shopName: '',
        counts: {},
        error: err.message || 'Failed to connect to Fullbay API',
      }
    }
  },

  async pullCustomers(apiKey: string): Promise<RawCustomer[]> {
    const paths = ['/customers', '/clients']
    let items: any[] = []

    for (const path of paths) {
      try {
        items = await fbPaginate(path, apiKey)
        if (items.length > 0) break
      } catch {
        // Try next path
      }
    }

    return items.map(c => ({
      external_id: safeStr(c.id),
      company_name: c.name || c.company_name || c.company || 'Unknown',
      dba_name: safeStr(c.dba_name || c.dba),
      dot_number: safeStr(c.dot_number || c.dot),
      mc_number: safeStr(c.mc_number || c.mc),
      phone: safeStr(c.phone || c.phone_number),
      email: safeStr(c.email),
      address: safeStr(c.address || c.street_address),
      city: safeStr(c.city),
      state: safeStr(c.state),
      zip: safeStr(c.zip || c.postal_code),
      payment_terms: safeStr(c.payment_terms || c.terms),
      tax_rate: safeNum(c.tax_rate),
      notes: safeStr(c.notes),
      contacts: Array.isArray(c.contacts) ? c.contacts.map((ct: any) => ({
        name: ct.name || ct.full_name || `${ct.first_name || ''} ${ct.last_name || ''}`.trim(),
        phone: safeStr(ct.phone || ct.phone_number),
        email: safeStr(ct.email),
        role: safeStr(ct.role || ct.title),
        is_primary: ct.is_primary || ct.primary || false,
      })) : undefined,
    }))
  },

  async pullVehicles(apiKey: string): Promise<RawVehicle[]> {
    const paths = ['/vehicles', '/units', '/equipment']
    let items: any[] = []

    for (const path of paths) {
      try {
        items = await fbPaginate(path, apiKey)
        if (items.length > 0) break
      } catch {
        // Try next path
      }
    }

    return items.map(v => ({
      external_id: safeStr(v.id),
      unit_number: v.unit_number || v.number || v.name || `UNIT-${v.id}`,
      vin: safeStr(v.vin),
      unit_type: safeStr(v.type || v.unit_type || v.equipment_type),
      year: safeNum(v.year) ?? null,
      make: safeStr(v.make),
      model: safeStr(v.model),
      engine: safeStr(v.engine || v.engine_type),
      transmission: safeStr(v.transmission || v.transmission_type),
      mileage: safeNum(v.mileage || v.odometer) ?? null,
      license_plate: safeStr(v.license_plate || v.plate),
      license_state: safeStr(v.license_state || v.plate_state),
      customer_name: safeStr(v.customer_name || v.customer?.name),
      customer_external_id: safeStr(v.customer_id),
      status: safeStr(v.status),
    }))
  },

  async pullServiceOrders(apiKey: string): Promise<RawServiceOrder[]> {
    const paths = ['/service-orders', '/work-orders', '/repairs']
    let items: any[] = []

    for (const path of paths) {
      try {
        items = await fbPaginate(path, apiKey)
        if (items.length > 0) break
      } catch {
        // Try next path
      }
    }

    return items.map(so => ({
      external_id: safeStr(so.id),
      so_number: so.number || so.so_number || so.wo_number || `FB-${so.id}`,
      customer_name: safeStr(so.customer_name || so.customer?.name),
      customer_external_id: safeStr(so.customer_id),
      unit_number: safeStr(so.unit_number || so.vehicle?.unit_number),
      unit_vin: safeStr(so.vin || so.vehicle?.vin),
      status: safeStr(so.status),
      priority: safeStr(so.priority),
      concern: safeStr(so.complaint || so.concern || so.description),
      cause: safeStr(so.cause || so.diagnosis),
      correction: safeStr(so.correction || so.repair || so.resolution),
      tech_name: safeStr(so.technician_name || so.tech_name || so.assigned_to),
      date_created: safeStr(so.created_at || so.date_created || so.opened_at),
      date_completed: safeStr(so.completed_at || so.date_completed || so.closed_at),
      total_labor_hours: safeNum(so.labor_hours || so.total_labor_hours),
      total_parts_cost: safeNum(so.parts_total || so.total_parts_cost),
      total_amount: safeNum(so.total || so.grand_total || so.total_amount),
      lines: Array.isArray(so.lines || so.line_items || so.items) ? (so.lines || so.line_items || so.items).map((l: any) => ({
        line_type: l.type || l.line_type || 'labor',
        description: l.description || l.name || '',
        part_number: safeStr(l.part_number || l.sku),
        quantity: safeNum(l.quantity || l.qty),
        unit_price: safeNum(l.unit_price || l.rate || l.price),
        total_price: safeNum(l.total || l.total_price || l.amount),
        hours: safeNum(l.hours || l.labor_hours),
        tech_name: safeStr(l.technician_name || l.tech_name),
      })) : undefined,
    }))
  },

  async pullInvoices(apiKey: string): Promise<RawInvoice[]> {
    const paths = ['/invoices']
    let items: any[] = []

    for (const path of paths) {
      try {
        items = await fbPaginate(path, apiKey)
        if (items.length > 0) break
      } catch {
        // Try next path
      }
    }

    return items.map(inv => ({
      external_id: safeStr(inv.id),
      invoice_number: inv.number || inv.invoice_number || `FB-INV-${inv.id}`,
      so_number: safeStr(inv.so_number || inv.service_order_number || inv.wo_number),
      customer_name: safeStr(inv.customer_name || inv.customer?.name),
      customer_external_id: safeStr(inv.customer_id),
      status: safeStr(inv.status),
      subtotal: safeNum(inv.subtotal),
      tax_rate: safeNum(inv.tax_rate),
      tax_amount: safeNum(inv.tax || inv.tax_amount),
      total: safeNum(inv.total || inv.grand_total),
      amount_paid: safeNum(inv.amount_paid || inv.paid),
      balance_due: safeNum(inv.balance || inv.balance_due),
      payment_terms: safeStr(inv.payment_terms || inv.terms),
      due_date: safeStr(inv.due_date || inv.due_at),
      paid_at: safeStr(inv.paid_at || inv.paid_date),
      payment_method: safeStr(inv.payment_method),
      date_created: safeStr(inv.created_at || inv.date_created || inv.date),
      lines: Array.isArray(inv.lines || inv.line_items || inv.items) ? (inv.lines || inv.line_items || inv.items).map((l: any) => ({
        line_type: l.type || l.line_type || 'service',
        description: l.description || l.name || '',
        quantity: safeNum(l.quantity || l.qty),
        unit_price: safeNum(l.unit_price || l.rate || l.price),
        total_price: safeNum(l.total || l.total_price || l.amount),
      })) : undefined,
    }))
  },

  async pullParts(apiKey: string): Promise<RawPart[]> {
    const paths = ['/parts', '/inventory', '/parts-inventory']
    let items: any[] = []

    for (const path of paths) {
      try {
        items = await fbPaginate(path, apiKey)
        if (items.length > 0) break
      } catch {
        // Try next path
      }
    }

    return items.map(p => ({
      part_number: safeStr(p.part_number || p.number || p.sku),
      description: p.description || p.name || 'Unknown Part',
      quantity: safeNum(p.quantity || p.on_hand || p.qty),
      unit_cost: safeNum(p.cost || p.unit_cost || p.cost_price),
      sell_price: safeNum(p.price || p.sell_price || p.retail_price),
      vendor: safeStr(p.vendor || p.supplier),
      location: safeStr(p.location || p.bin || p.bin_location),
      min_stock: safeNum(p.min_stock || p.reorder_point || p.min_quantity),
      category: safeStr(p.category),
    }))
  },

  async pullTechnicians(apiKey: string): Promise<RawTechnician[]> {
    const paths = ['/technicians', '/techs', '/users', '/employees']
    let items: any[] = []

    for (const path of paths) {
      try {
        items = await fbPaginate(path, apiKey)
        if (items.length > 0) break
      } catch {
        // Try next path
      }
    }

    // Filter to technician-type users if we hit /users
    const techs = items.filter(t =>
      !t.role || ['technician', 'tech', 'mechanic'].includes(String(t.role).toLowerCase())
    )

    return techs.map(t => ({
      full_name: t.name || t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unknown',
      email: safeStr(t.email),
      phone: safeStr(t.phone || t.phone_number),
      role: safeStr(t.role || t.position) || 'technician',
      team: safeStr(t.team || t.department),
      skills: Array.isArray(t.skills) ? t.skills : undefined,
      hourly_rate: safeNum(t.hourly_rate || t.rate),
    }))
  },
}
