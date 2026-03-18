// lib/integrations/finditparts.ts
// FinditParts heavy truck parts catalog API
// Docs: https://api.finditparts.com

export interface PartResult {
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
  year?:  number
  make?:  string
  model?: string
  limit?: number
}): Promise<PartResult[]> {
  const apiKey = process.env.FINDITPARTS_API_KEY
  if (!apiKey) return []

  const params = new URLSearchParams({
    q:     query,
    limit: String(options?.limit || 10),
    ...(options?.year  ? { year:  String(options.year) } : {}),
    ...(options?.make  ? { make:  options.make }          : {}),
    ...(options?.model ? { model: options.model }         : {}),
  })

  try {
    const res = await fetch(`https://api.finditparts.com/v2/search?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).map((r: any): PartResult => ({
      part_number:  r.part_number || r.sku || '',
      description:  r.description || r.name || '',
      manufacturer: r.brand || r.manufacturer || '',
      price:        r.price ? parseFloat(r.price) : null,
      in_stock:     r.availability === 'in_stock' || r.in_stock === true,
      image_url:    r.image || r.image_url || null,
      category:     r.category || null,
      fitment:      r.fitment || [],
    }))
  } catch {
    return []
  }
}

export async function getPartPrice(partNumber: string): Promise<number | null> {
  const results = await searchParts(partNumber, { limit: 1 })
  return results[0]?.price ?? null
}

export async function checkStock(partNumber: string): Promise<boolean> {
  const results = await searchParts(partNumber, { limit: 1 })
  return results[0]?.in_stock ?? false
}
