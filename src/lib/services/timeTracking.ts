import type { ActiveClock } from '@/types'

export async function clockIn(soLineId: string, userId: string, serviceOrderId?: string, shopId?: string): Promise<{ id: string; clocked_in_at: string } | null> {
  const res = await fetch('/api/mechanic/clock-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ so_line_id: soLineId, user_id: userId, service_order_id: serviceOrderId, shop_id: shopId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Clock in failed')
  }
  return res.json()
}

export async function clockOut(timeEntryId: string, userId?: string, notes?: string): Promise<{ duration_minutes: number; total_hours_on_job: number }> {
  const res = await fetch('/api/mechanic/clock-out', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ time_entry_id: timeEntryId, user_id: userId, notes }),
  })
  if (!res.ok) throw new Error('Clock out failed')
  return res.json()
}

export async function getActiveClock(userId: string): Promise<ActiveClock | null> {
  const res = await fetch(`/api/mechanic/active-clock?user_id=${userId}`)
  if (!res.ok) return null
  return res.json()
}

export async function getActiveTechs(shopId: string): Promise<{ id: string; mechanic_name: string; team: string | null; wo_number: string; job_description: string; clocked_in_at: string }[]> {
  const res = await fetch(`/api/time-tracking/active?shop_id=${shopId}`)
  if (!res.ok) return []
  return res.json()
}
