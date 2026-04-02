import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types'

export async function getUsers(shopId: string): Promise<User[]> {
  const supabase = createClient()
  const { data } = await supabase.from('users').select('*').eq('shop_id', shopId).is('deleted_at', null).order('full_name')
  return (data || []) as User[]
}

export async function getMechanics(shopId: string): Promise<User[]> {
  const supabase = createClient()
  const { data } = await supabase.from('users').select('*').eq('shop_id', shopId).in('role', ['technician', 'lead_tech', 'maintenance_technician']).is('deleted_at', null).order('full_name')
  return (data || []) as User[]
}
