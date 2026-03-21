'use client'
import { useState, useCallback } from 'react'

export interface VinResult {
  year: number | null
  make: string
  model: string
  body_type: string
  engine: string
  fuel_type: string
  transmission: string
  drive_type: string
  gvwr: string
  error_code: string
}

export function useVinDecode() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VinResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const decode = useCallback(async (vin: string): Promise<VinResult | null> => {
    const v = vin.trim().toUpperCase()
    if (v.length !== 17) { setError('VIN must be 17 characters'); return null }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vin/${v}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return null }
      setResult(data)
      return data
    } catch {
      setError('VIN decode failed')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { decode, result, loading, error }
}
