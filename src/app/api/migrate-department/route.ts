import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST() {
  const s = db()

  // Check if column exists by trying to select it
  const { error: checkErr } = await s.from('users').select('department').limit(1)

  if (checkErr && checkErr.message.includes('does not exist')) {
    // Column doesn't exist — need to add it via SQL
    // Use the Supabase Management API to run DDL
    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').split('.')[0]

    // Since we can't run DDL via PostgREST, we'll use the pg connection
    // Instead, backfill using the existing schema by updating via a workaround
    return NextResponse.json({
      error: 'Column "department" does not exist. Please run this SQL in the Supabase Dashboard SQL Editor:\n\nALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT DEFAULT NULL;\n\nUPDATE users SET department = CASE\n  WHEN role IN (\'service_writer\', \'service_manager\') THEN \'service\'\n  WHEN role IN (\'parts_manager\', \'parts_staff\') THEN \'parts\'\n  WHEN role IN (\'technician\', \'shop_manager\', \'floor_manager\', \'floor_supervisor\') THEN \'floor\'\n  WHEN role IN (\'accountant\', \'accounting_manager\', \'office_admin\') THEN \'accounting\'\n  WHEN role IN (\'maintenance_technician\', \'maintenance_manager\') THEN \'maintenance\'\n  WHEN role IN (\'fleet_manager\', \'dispatcher\') THEN \'fleet\'\n  WHEN role = \'driver\' THEN \'drivers\'\n  WHEN role IN (\'owner\', \'gm\', \'it_person\') THEN \'management\'\n  ELSE NULL\nEND\nWHERE department IS NULL;',
      status: 'needs_migration'
    }, { status: 200 })
  }

  // Column exists — backfill any rows with null department
  const { data: nullDept } = await s.from('users').select('id, role').is('department', null)

  if (nullDept && nullDept.length > 0) {
    const roleMap: Record<string, string> = {
      service_writer: 'service', service_manager: 'service',
      parts_manager: 'parts', parts_staff: 'parts',
      technician: 'floor', shop_manager: 'floor', floor_manager: 'floor', floor_supervisor: 'floor',
      accountant: 'accounting', accounting_manager: 'accounting', office_admin: 'accounting',
      maintenance_technician: 'maintenance', maintenance_manager: 'maintenance',
      fleet_manager: 'fleet', dispatcher: 'fleet',
      driver: 'drivers',
      owner: 'management', gm: 'management', it_person: 'management',
    }

    let updated = 0
    for (const u of nullDept) {
      const dept = roleMap[u.role]
      if (dept) {
        await s.from('users').update({ department: dept }).eq('id', u.id)
        updated++
      }
    }
    return NextResponse.json({ status: 'backfilled', updated })
  }

  return NextResponse.json({ status: 'ok', message: 'All users already have departments' })
}
