export interface TimeEntry {
  id: string
  shop_id: string
  user_id: string
  so_line_id: string
  service_order_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  duration_minutes: number | null
  notes: string | null
  created_at: string
  // Joined
  users?: { full_name: string; team: string | null }
  so_lines?: { description: string }
  service_orders?: { so_number: string; assets?: { unit_number: string; make: string | null; model: string | null }; customers?: { company_name: string } }
}

export interface ActiveClock {
  id: string
  clocked_in_at: string
  so_line_id: string
  service_order_id: string
  job_description: string
  wo_number: string
}
