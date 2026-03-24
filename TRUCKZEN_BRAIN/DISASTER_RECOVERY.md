# TruckZen Disaster Recovery Plan

## If truckzen.pro goes down

1. Check UptimeRobot alert email for what failed
2. Go to https://vercel.com/dashboard — check deployment status
3. If Vercel shows error — go to Deployments tab — click "Promote to Production" on last working deployment
4. If DB issue — go to supabase.com/dashboard — check project status
5. If Supabase paused — click "Resume project"
6. Test https://truckzen.pro/api/health — should return {"status":"ok"}

## If data is corrupted or deleted

1. Go to supabase.com/dashboard → your project → Backups
2. If PITR enabled: restore to specific point in time before the issue
3. If not: go to Storage → backups bucket → download latest weekly backup JSON files
4. Also check `backups-offsite` bucket for secondary copies
5. Contact Supabase support: supabase.com/support

## If Mac dies and you lose .env.local

Critical env vars needed to rebuild:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- RESEND_API_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- ANTHROPIC_API_KEY
- CRON_SECRET

These should be backed up in 1Password or your email.
All env vars are also visible in Vercel dashboard → Project → Settings → Environment Variables.

## Emergency contacts

- Vercel support: vercel.com/help
- Supabase support: supabase.com/support
- Domain (Namecheap): namecheap.com/support
