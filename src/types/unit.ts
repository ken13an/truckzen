export type UnitType = 'tractor' | 'trailer' | 'reefer' | 'straight_truck' | 'box_truck' | 'flatbed' | 'tanker' | 'other'
export type UnitStatus = 'active' | 'inactive' | 'in_shop' | 'sold'

export interface Unit {
  id: string
  shop_id: string
  customer_id: string | null
  unit_number: string
  unit_type: UnitType
  status: UnitStatus
  vin: string | null
  year: number | null
  make: string | null
  model: string | null
  engine: string | null
  transmission: string | null
  odometer: number | null
  license_plate: string | null
  license_state: string | null
  color: string | null
  notes: string | null
  created_at: string
  // Joined
  customers?: { company_name: string }
}
