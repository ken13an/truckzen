# TruckZen Backup Status

## Current Backup Configuration

| Type | Schedule | Tables | Destination |
|------|----------|--------|-------------|
| Weekly Full | Sundays 2:00 AM UTC | customers, assets, service_orders, repair_orders, invoices, parts, purchase_orders, users, vendors | `backups` + `backups-offsite` buckets |
| Daily Critical | Daily 3:00 AM UTC | users, customers, work_orders, invoices, assets | `backups` + `backups-offsite` buckets |

## Storage Buckets

- **backups** — Primary backup bucket (private)
- **backups-offsite** — Secondary/offsite backup bucket (private)

## Backup Format

- Path: `weekly/{YYYY-MM-DD}/{table}.json` or `daily/{YYYY-MM-DD}/{table}.json`
- Format: JSON array of all rows
- Auth: `Bearer ${CRON_SECRET}` header required

## Cron Jobs (vercel.json)

- `/api/admin/backup` — `0 2 * * 0` (Sunday 2am)
- `/api/admin/backup/daily` — `0 3 * * *` (Daily 3am)

## Supabase PITR

Check your Supabase dashboard → Project → Backups to verify:
- Whether PITR (Point-in-Time Recovery) is enabled (requires Pro plan)
- Supabase automatic daily backups (included on all paid plans)

## Last Verified

- Date: 2026-03-24
- Status: Backup routes deployed, dual-bucket write confirmed
