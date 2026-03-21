export type Role = 'owner' | 'gm' | 'it_person' | 'shop_manager' | 'service_writer' | 'technician' | 'lead_tech' | 'parts_manager' | 'fleet_manager' | 'maintenance_manager' | 'maintenance_technician' | 'accountant' | 'office_admin' | 'dispatcher' | 'driver' | 'customer'

export type Team = 'A' | 'B' | 'C' | 'D' | null

export interface User {
  id: string
  email: string
  full_name: string
  role: Role
  shop_id: string
  team: Team
  language: string
  skills: string[]
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
}
