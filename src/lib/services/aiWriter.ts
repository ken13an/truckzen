export type AIContext = 'kiosk' | 'service_writer' | 'mechanic' | 'supervisor'

export interface AIResult {
  concern?: string
  concern_native?: string | null
  cause?: string
  correction?: string
  parts?: string[]
  labor_hours?: number
  cause_native?: string | null
  correction_native?: string | null
  note?: string
  note_native?: string | null
}

export async function generateAIAssist(
  text: string,
  context: AIContext,
  options?: { language?: string; truckInfo?: { year?: string; make?: string; model?: string; engine?: string }; shopId?: string; userId?: string }
): Promise<AIResult> {
  const res = await fetch('/api/ai/service-writer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      context,
      language: options?.language || 'en',
      truck_info: options?.truckInfo,
      shop_id: options?.shopId,
      user_id: options?.userId,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'AI request failed')
  }
  return res.json()
}
