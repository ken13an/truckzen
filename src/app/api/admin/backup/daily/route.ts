import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CRITICAL_TABLES = ['users', 'customers', 'work_orders', 'invoices', 'assets']

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Ensure offsite bucket exists
  await db.storage.createBucket('backups-offsite', { public: false }).catch(() => {})

  const timestamp = new Date().toISOString().split('T')[0]
  const results: Record<string, number> = {}

  for (const table of CRITICAL_TABLES) {
    const { data, error } = await db.from(table).select('*')
    if (error) { results[table] = -1; continue }

    const content = JSON.stringify(data)
    const path = `daily/${timestamp}/${table}.json`

    // Primary backup
    await db.storage
      .from('backups')
      .upload(path, content, { contentType: 'application/json', upsert: true })

    // Offsite backup
    await db.storage
      .from('backups-offsite')
      .upload(path, content, { contentType: 'application/json', upsert: true })

    results[table] = data?.length || 0
  }

  return NextResponse.json({
    backup_date: timestamp,
    type: 'daily_critical',
    tables: results,
    total_records: Object.values(results).filter(v => v > 0).reduce((a, b) => a + b, 0)
  })
}
