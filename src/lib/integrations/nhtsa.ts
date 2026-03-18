// lib/integrations/nhtsa.ts
// Free NHTSA VIN API — no key needed
export interface VINDecodeResult {
  year:   number | null
  make:   string | null
  model:  string | null
  trim:   string | null
  engine: string | null
  gvwr:   string | null
  type:   string | null
  valid:  boolean
  error?: string
}

export async function decodeVIN(vin: string): Promise<VINDecodeResult> {
  const cleaned = vin.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '')

  if (cleaned.length !== 17) {
    return { year:null, make:null, model:null, trim:null, engine:null, gvwr:null, type:null, valid:false, error:'VIN must be 17 characters' }
  }

  try {
    const res  = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${cleaned}?format=json`, { next: { revalidate: 86400 } })
    const data = await res.json()
    const r    = data.Results?.[0]
    if (!r || r.ErrorCode !== '0') {
      return { year:null, make:null, model:null, trim:null, engine:null, gvwr:null, type:null, valid:false, error: r?.ErrorText || 'Invalid VIN' }
    }
    return {
      valid:  true,
      year:   parseInt(r.ModelYear) || null,
      make:   r.Make || null,
      model:  r.Model || null,
      trim:   r.Trim || null,
      engine: [r.DisplacementL ? `${r.DisplacementL}L` : '', r.FuelTypePrimary || '', r.EngineCylinders ? `${r.EngineCylinders}-cyl` : ''].filter(Boolean).join(' ') || null,
      gvwr:   r.GVWR || null,
      type:   r.BodyClass || null,
    }
  } catch (err: any) {
    return { year:null, make:null, model:null, trim:null, engine:null, gvwr:null, type:null, valid:false, error: err.message }
  }
}


// lib/integrations/finditparts.ts
// FinditParts API — heavy truck parts catalog
// Docs: https://api.finditparts.com/docs
export interface PartSearchResult {
  part_number:  string
  description:  string
  manufacturer: string
  price:        number | null
  in_stock:     boolean
  image_url:    string | null
  category:     string | null
  fitment:      string[]
}

export async function searchParts(query: string, options?: {
  year?: number
  make?: string
  model?: string
  limit?: number
}): Promise<PartSearchResult[]> {
  const apiKey = process.env.FINDITPARTS_API_KEY
  if (!apiKey) {
    console.warn('FINDITPARTS_API_KEY not set — returning empty results')
    return []
  }

  const params = new URLSearchParams({
    q:     query,
    limit: String(options?.limit || 10),
    ...(options?.year  ? { year:  String(options.year)  } : {}),
    ...(options?.make  ? { make:  options.make           } : {}),
    ...(options?.model ? { model: options.model          } : {}),
  })

  try {
    const res  = await fetch(`https://api.finditparts.com/v2/search?${params}`, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).map((r: any) => ({
      part_number:  r.part_number || r.sku,
      description:  r.description || r.name,
      manufacturer: r.brand || r.manufacturer,
      price:        r.price ? parseFloat(r.price) : null,
      in_stock:     r.availability === 'in_stock' || r.in_stock === true,
      image_url:    r.image || r.image_url || null,
      category:     r.category || null,
      fitment:      r.fitment || [],
    }))
  } catch (err: any) {
    console.error('FinditParts error:', err.message)
    return []
  }
}

export async function getPartByNumber(partNumber: string): Promise<PartSearchResult | null> {
  const results = await searchParts(partNumber, { limit: 1 })
  return results[0] || null
}
