export type JobStatus = 'pending' | 'accepted' | 'declined' | 'in_progress' | 'completed'

export interface JobAssignment {
  id: string
  so_line_id: string
  assigned_to_user_id: string
  assigned_by_user_id: string | null
  status: JobStatus
  percentage: number
  decline_reason: string | null
  accepted_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  // Joined
  users?: { full_name: string; team: string | null; skills: string[] }
  so_lines?: { description: string; estimated_hours: number | null; required_skills: string[] }
}

export interface MechanicJob {
  id: string
  so_line_id: string
  work_order_id: string
  wo_number: string
  description: string
  status: JobStatus
  customer_name: string
  unit_number: string
  unit_type: string
  expected_hours: number | null
  mechanic_name: string | null
}
