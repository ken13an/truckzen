export type WOStatus = 'draft' | 'not_approved' | 'waiting_approval' | 'in_progress' | 'waiting_parts' | 'done' | 'ready_final_inspection' | 'good_to_go' | 'failed_inspection' | 'void'
export type WOPriority = 'low' | 'normal' | 'high' | 'critical'
export type LineType = 'labor' | 'job' | 'part' | 'shop_charge' | 'sublet'
// LineStatus is owned by src/lib/state/line-status.ts. The previous local
// union here drifted from the values the API validator actually accepts
// ('assigned' / 'void' were never valid; 'pending_review' / 'approved' were
// missing). Imported once and re-exported so existing `from '@/types'`
// consumers keep their import path AND the WOLine interface below can
// reference the type by name.
import type { LineStatus } from '@/lib/state/line-status'
export type { LineStatus }

export interface WorkOrder {
  id: string
  shop_id: string
  so_number: string
  customer_id: string | null
  asset_id: string | null
  status: WOStatus
  priority: WOPriority
  concern: string
  complaint: string | null
  authorization: string | null
  auth_limit: number | null
  estimated_completion: string | null
  parked_location: string | null
  keys_left: string | null
  odometer_in: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  customers?: { company_name: string; contact_name: string | null; phone: string | null; email: string | null }
  assets?: { unit_number: string; year: number | null; make: string | null; model: string | null; vin: string | null; unit_type: string }
}

export interface WOLine {
  id: string
  service_order_id: string
  line_type: LineType
  description: string
  line_status: LineStatus
  part_number: string | null
  quantity: number
  unit_price: number
  total_price: number
  estimated_hours: number | null
  actual_hours: number | null
  required_skills: string[]
  sort_order: number
  created_at: string
}

export interface WONote {
  id: string
  service_order_id: string
  user_id: string
  note_text: string
  visible_to_customer: boolean
  created_at: string
  users?: { full_name: string }
}

export interface WOFile {
  id: string
  service_order_id: string
  file_url: string
  filename: string
  uploaded_by: string | null
  created_at: string
}

export interface WOActivity {
  id: string
  service_order_id: string
  action: string
  details: string | null
  user_id: string | null
  created_at: string
  users?: { full_name: string }
}
