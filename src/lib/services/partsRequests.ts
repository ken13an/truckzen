import type { PartsRequest } from '@/types'

export async function getPartsRequests(shopId: string): Promise<PartsRequest[]> {
  const res = await fetch(`/api/floor-manager/parts-requests?shop_id=${shopId}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function getMechanicPartsRequests(userId: string): Promise<PartsRequest[]> {
  const res = await fetch(`/api/mechanic/parts-request?user_id=${userId}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : data.data || []
}

export async function submitPartsRequest(data: { user_id: string; assignment_id: string; work_order_id: string; part_name: string; quantity: number; notes: string }): Promise<boolean> {
  const res = await fetch('/api/mechanic/parts-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.ok
}

export async function updatePartsRequest(id: string, action: string, options?: { reason?: string; in_stock?: boolean; user_id?: string }): Promise<boolean> {
  const res = await fetch('/api/floor-manager/parts-requests', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, ...options }),
  })
  return res.ok
}
