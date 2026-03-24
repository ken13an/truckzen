import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const tables = [
    'customers', 'assets', 'service_orders', 'repair_orders',
    'invoices', 'parts', 'purchase_orders', 'users', 'vendors'
  ]

  const timestamp = new Date().toISOString().split('T')[0]
  const results: Record<string, number> = {}

  for (const table of tables) {
    const { data, error } = await db.from(table).select('*')
    if (error) { results[table] = -1; continue }

    const { error: uploadError } = await db.storage
      .from('backups')
      .upload(
        `weekly/${timestamp}/${table}.json`,
        JSON.stringify(data),
        { contentType: 'application/json', upsert: true }
      )

    results[table] = uploadError ? -1 : (data?.length || 0)
  }

  return NextResponse.json({
    backup_date: timestamp,
    tables: results,
    total_records: Object.values(results).filter(v => v > 0).reduce((a, b) => a + b, 0)
  })
}
