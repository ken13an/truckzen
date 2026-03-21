export type RequestStatus = 'pending' | 'in_stock' | 'ordered' | 'rejected' | 'ready' | 'picked_up'

export interface PartsRequest {
  id: string
  shop_id: string
  so_line_id: string | null
  service_order_id: string | null
  requested_by: string
  part_name: string
  part_number: string | null
  quantity: number
  notes: string | null
  status: RequestStatus
  in_stock: boolean
  approved_by_user_id: string | null
  approved_at: string | null
  rejected_reason: string | null
  ordered_at: string | null
  ready_at: string | null
  picked_up_at: string | null
  created_at: string
  // Joined
  users?: { full_name: string }
}
