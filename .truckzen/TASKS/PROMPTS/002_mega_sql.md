# Prompt 002 -- Phase 1 Mega SQL Migration

## Priority: CRITICAL (all Phase 1 features depend on these tables)
## Estimated time: 10-15 minutes

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.

2. Read the full SQL file at .truckzen/TASKS/PHASE1_SCHEMA.sql. Understand every table.

3. Run the SQL migration against Supabase. Try these methods in order until one works:

   **Method A -- Supabase CLI:**
   ```bash
   supabase --version
   # If installed and linked:
   mkdir -p supabase/migrations
   cp .truckzen/TASKS/PHASE1_SCHEMA.sql supabase/migrations/$(date +%Y%m%d%H%M%S)_phase1_schema.sql
   supabase db push
   ```

   **Method B -- Direct psql:**
   ```bash
   # Find connection string in env files:
   grep -i "database_url\|supabase.*url\|postgres" .env.local .env 2>/dev/null
   # Run migration:
   psql "$DATABASE_URL" -f .truckzen/TASKS/PHASE1_SCHEMA.sql
   ```

   **Method C -- Temporary Node script (if A and B fail):**
   Create a temporary file run-migration.js:
   ```javascript
   const fs = require('fs')
   const path = require('path')

   // Read env vars from .env.local
   const envFile = fs.readFileSync('.env.local', 'utf-8')
   const envVars = {}
   envFile.split('\n').forEach(line => {
     const [key, ...val] = line.split('=')
     if (key && val.length) envVars[key.trim()] = val.join('=').trim()
   })

   const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL
   const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY

   if (!SUPABASE_URL || !SERVICE_KEY) {
     console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local')
     process.exit(1)
   }

   // Use Supabase REST API to run SQL via the /rest/v1/rpc endpoint
   // First we need to create a helper function, then run our migration
   async function run() {
     const sql = fs.readFileSync('.truckzen/TASKS/PHASE1_SCHEMA.sql', 'utf-8')

     // Use the Supabase SQL endpoint (requires service role key)
     const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'apikey': SERVICE_KEY,
         'Authorization': `Bearer ${SERVICE_KEY}`,
         'Prefer': 'return=minimal'
       }
     })

     // If RPC doesn't work, try the pg endpoint
     // The most reliable approach: use Supabase's built-in pg_net or direct connection
     console.log('NOTE: If this script fails, the SQL must be run manually.')
     console.log('Tell the user: "Run the SQL in .truckzen/TASKS/PHASE1_SCHEMA.sql in Supabase Dashboard > SQL Editor"')
     console.log('')
     console.log('Supabase URL:', SUPABASE_URL)
     console.log('SQL file size:', sql.length, 'bytes')
     console.log('Tables to create: units, repair_orders, repair_order_lines, time_entries, parts, ro_line_parts, estimates, estimate_lines, invoices, invoice_lines, payments, job_templates, ai_usage_log, ro_photos, shop_sequences')
   }
   run()
   ```
   ```bash
   node run-migration.js
   rm run-migration.js  # clean up
   ```

   **REALITY CHECK: Methods A and B are the only reliable ways to run SQL from Terminal.**
   If neither psql nor supabase CLI is available, tell the user:
   "I need you to run the SQL migration. Open Supabase Dashboard > SQL Editor > New Query > paste the contents of .truckzen/TASKS/PHASE1_SCHEMA.sql > click Run. Tell me when done."
   Do NOT pretend the migration ran if you cannot verify it. Wait for confirmation before continuing.

4. Verify tables exist using whichever DB access method worked:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' ORDER BY table_name;
   ```
   Expected new tables: ai_usage_log, estimate_lines, estimates, invoice_lines, invoices, job_templates, parts, payments, repair_order_lines, repair_orders, ro_line_parts, ro_photos, shop_sequences, time_entries, units

5. Create TypeScript types at src/types/database.ts with interfaces for all new tables: Unit, RepairOrder, RepairOrderLine, TimeEntry, Part, ROLinePart, Estimate, Invoice, Payment. Every field that can be null must be typed as `string | null` or `number | null`. Match the exact column names and types from PHASE1_SCHEMA.sql.

6. Run `npm run build` to confirm types file compiles clean.

7. Git commit and push.

8. Update all .truckzen/DONE/ files per CC_RULES.
